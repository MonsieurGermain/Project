/* eslint-disable class-methods-use-this */
const { MoneroWalletListener, BigInteger } = require('monero-javascript');
const { EscrowModel, ESCROW_STATUS } = require('../models/escrow');
const {
  WrongTransactionModel,
  WRONG_TRANSACTION_TYPES,
  TRANSACTION_TYPES,
} = require('../models/wrongTransaction');

class EscrowListener extends MoneroWalletListener {
  constructor(escrow) {
    super();

    this.escrow = escrow;
  }

  // when someone sends money to the escrow address
  async onOutputReceived(input) {
    console.log('Output received!');
    console.log(input);

    const tx = input.getTx();

    const isConfirmed = tx.isConfirmed();
    const isRelayed = tx.isRelayed();
    const isFailed = tx.isFailed();
    const address = input.getAddress();

    if (!isConfirmed || !isRelayed || isFailed) {
      return;
    }

    const paymentId = tx.getPaymentId();

    if (!paymentId) {
      await WrongTransactionModel.create({
        address,
        transactionType: TRANSACTION_TYPES.INCOMING,
        txHash: tx.getHash(),
        type: WRONG_TRANSACTION_TYPES.BAD_PAYMENT_ID,
      });

      return;
    }

    const escrow = await EscrowModel.findOne({
      paymentId,
    });

    if (!escrow) {
      await WrongTransactionModel.create({
        address,
        transactionType: TRANSACTION_TYPES.INCOMING,
        txHash: tx.getHash(),
        type: WRONG_TRANSACTION_TYPES.BAD_PAYMENT_ID,
      });

      return;
    }

    const { status, amountAtomic, paymentAddress } = escrow;

    if (status === ESCROW_STATUS.RELEASED) {
      await WrongTransactionModel.create({
        address,
        transactionType: TRANSACTION_TYPES.INCOMING,
        txHash: tx.getHash(),
        type: WRONG_TRANSACTION_TYPES.ALREADY_RELEASED,
      });

      return;
    }

    if (status === ESCROW_STATUS.CANCELLED) {
      await WrongTransactionModel.create({
        address,
        transactionType: TRANSACTION_TYPES.INCOMING,
        txHash: tx.getHash(),
        type: WRONG_TRANSACTION_TYPES.ALREADY_CANCELLED,
      });
      return;
    }

    const transactions = await this.escrow.checkIncomingTransactionByAddress(
      paymentAddress,
    );

    const trxAmount = transactions.reduce((acc, trx) => {
      const amount = trx.getAmount();

      return acc.add(amount);
    }, BigInteger.ZERO);

    if (trxAmount.compare(amountAtomic) >= 0) {
      escrow.set({
        status: ESCROW_STATUS.RECEIVED,
        statusDate: new Date(),
      });

      // you can change order status here

      await escrow.save();
    }
  }

  // when escrow releases the money
  async onOutputSpent(output) {
    const tx = output.getTx();
    const hash = tx.getHash();
    const isConfirmed = tx.isConfirmed();
    const isRelayed = tx.isRelayed();
    const isFailed = tx.isFailed();
    const address = output.getAddress();

    if (!isConfirmed || !isRelayed || isFailed) {
      return;
    }

    const escrow = await EscrowModel.findOne({
      releaseTxHash: hash,
    });

    if (!escrow) { // just in case
      await WrongTransactionModel.create({
        address,
        transactionType: TRANSACTION_TYPES.OUTGOING,
        txHash: hash,
        type: WRONG_TRANSACTION_TYPES.UNAUTHORIZED,
      });
      return;
    }

    if (escrow.status !== ESCROW_STATUS.RELEASING) { // just in case
      await WrongTransactionModel.create({
        address,
        transactionType: TRANSACTION_TYPES.OUTGOING,
        txHash: hash,
        type: WRONG_TRANSACTION_TYPES.BAD_ESCROW_STATUS,
      });
      return;
    }

    escrow.set({
      status: ESCROW_STATUS.RELEASED,
      statusDate: new Date(),
    });

    // you can change order status here

    await escrow.save();
  }
}

module.exports = { EscrowListener };
