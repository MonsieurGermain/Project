/* eslint-disable class-methods-use-this */
const monerojs = require('monero-javascript');

const { BigInteger } = monerojs;

const ATOMIC_UNIT = '1000000000000';

// Convert from atomic units to XMR float
const toFloat = (amount, precision) => {
  const roundUnit = BigInteger.parse(ATOMIC_UNIT).divide(10 ** precision);

  const floatAmount = BigInteger.parse(amount).divide(roundUnit).toJSValue();

  return floatAmount / 10 ** precision;
};

const connectToMonero = async ({ address, username, password }) => {
  const walletRpc = await monerojs.connectToWalletRpc(
    address,
    username,
    password,
  );

  return walletRpc;
};

const connectToWallet = async ({ walletRpc, walletName, walletPass }) => {
  try {
    const wallet = await walletRpc.createWallet({
      path: walletName,
      password: walletPass,
    });

    return wallet;
  } catch (err) {
    console.log('err', err);

    const wallet = await walletRpc.openWallet(walletName, walletPass);

    return wallet;
  }
};

const getAccount = async ({ walletRpc }) => {
  const account = await walletRpc.getAccount(0);

  return account;
};

const createAccount = async ({ walletRpc }) => {
  const account = await walletRpc.createAccount();

  return account;
};

const createOrGetAccount = async ({ walletRpc }) => {
  try {
    const account = await createAccount({ walletRpc });

    return account;
  } catch (err) {
    const account = await getAccount({ walletRpc });

    return account;
  }
};

module.exports = {
  ATOMIC_UNIT,
  toFloat,
  connectToMonero,
  connectToWallet,
  getAccount,
  createAccount,
  createOrGetAccount,
};
