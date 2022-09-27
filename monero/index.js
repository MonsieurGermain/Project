/* eslint-disable class-methods-use-this */
const monerojs = require('monero-javascript');

const config = {
  walletRpc: undefined,
  accountIndex: 0,
};

class OutputListener extends monerojs.MoneroWalletListener {
  onOutputReceived(output) {
    let amount = output.getAmount().toString();
    let txHash = output.getTx().getHash();
    let isConfirmed = output.getTx().isConfirmed();
    let isLocked = output.getTx().isLocked();

    console.log('Output received', {
      amount,
      txHash,
      isConfirmed,
      isLocked,
    });
  }
}

const getBalance = async () => {
  const { walletRpc, accountIndex } = config;

  walletRpc.getBalance(accountIndex);
};

const getPaymentAddress = async (paymentId) => {
  const { walletRpc, accountIndex } = config;

  const address = await walletRpc.getAddress(accountIndex);

  return walletRpc.getIntegratedAddress(address, paymentId);
};

const checkPayment = async (paymentId) => {
  console.log('Not defined yet!', paymentId);
};

const createTransaction = async () => {
  console.log('Not defined yet!');
};

const relayTransaction = async () => {
  console.log('Not defined yet!');
};

const setupMonero = async ({
  walletRpcAddress,
  username,
  password,
  walletName,
  walletPass,
  accountIndex = 0,
}) => {
  config.accountIndex = accountIndex;

  config.walletRpc = await monerojs.connectToWalletRpc(
    walletRpcAddress,
    username,
    password,
  );

  // Create or open wallet

  try {
    await config.walletRpc.createWallet({
      path: walletName,
      password: walletPass,
    });
  } catch (err) {
    console.log(err, 'err');

    await config.walletRpc.openWallet(walletName, walletPass);
  }

  return config.walletRpc;
};

module.exports = {
  setupMonero,
  OutputListener,
  getBalance,
  checkPayment,
  getPaymentAddress,
  createTransaction,
  relayTransaction,
};
