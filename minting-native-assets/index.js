const { execSync } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync, statSync } = require("node:fs");
const path = require("node:path");

// Prerequisites:
// Download and extract these :
// https://update-cardano-mainnet.iohk.io/cardano-node-releases/cardano-node-8.0.0-macos.tar.gz
// https://github.com/input-output-hk/offchain-metadata-tools/releases/download/v0.4.0.0/token-metadata-creator.tar.gz

// I run the cardano node on a remote computer.
// Follow these steps to use the socket remotely
// SERVER
// docker run -d --name cardano-preprod -v /data-ssd/cardano/data:/data -v /data-ssd/cardano/ipc/:/ipc -e NETWORK=preprod inputoutput/cardano-node
// sudo yum install socat
// sudo firewall-cmd --zone=public --add-port=1234/tcp
// sudo firewall-cmd --zone=public --add-port=1234/udp
// sudo socat TCP-LISTEN:1234,fork,reuseaddr UNIX-CONNECT:/data-ssd/cardano/ipc/node.socket

// CLIENT
// sudo port install socat
// socat UNIX-LISTEN:/tmp/cardano.sock,fork,reuseaddr,mode=755 TCP:192.168.2.19:1234 &

process.env.CARDANO_NODE_SOCKET_PATH = "/tmp/cardano.sock";
const CARDANO_PATH = "../cardano-node-8.0.0-macos/";
const NETWORK = "--testnet-magic 1";

// Configurations
const tokenName = "DT";
const tokenAmount = 1000000000;

// Functions
function command(cmd, check = null) {
  if (check && statSync(path.join(tokenName, check)).isFile()) {
    console.debug(`✘ Command skipped`);
    return;
  }
  let output = execSync(cmd, { cwd: tokenName }).toString();
  console.debug("✔︎ Command executed with success");
  return output.trim();
}

// Main
(async () => {
  try {
    mkdirSync(path.join(tokenName), { recursive: true });

    command(`${CARDANO_PATH}cardano-cli query tip ${NETWORK}`);

    tokenBase16 = command(`echo -n "${tokenName}" | xxd -ps | tr -d '\n'`);
    console.debug(`ℹ︎ Token Base16 encoding: '${tokenBase16}'`);

    command(
      `${CARDANO_PATH}cardano-cli address key-gen \\
          --verification-key-file payment.vkey \\
          --signing-key-file payment.skey`,
      "payment.vkey"
    );

    command(
      `${CARDANO_PATH}cardano-cli address build \\
          --payment-verification-key-file payment.vkey \\
          --out-file payment.addr \\
          ${NETWORK}`,
      "payment.addr"
    );

    address = readFileSync(path.join(tokenName, "payment.addr"));
    console.debug(`ℹ︎ Address: '${address}'`);

    command(
      `${CARDANO_PATH}cardano-cli query protocol-parameters \\
          ${NETWORK} \\
          --out-file protocol.json`,
      "protocol.json"
    );

    mkdirSync(path.join(tokenName, "policy"), { recursive: true });

    command(
      `${CARDANO_PATH}cardano-cli address key-gen \\
          --verification-key-file policy/policy.vkey \\
          --signing-key-file policy/policy.skey`,
      "policy/policy.vkey"
    );

    const keyHash = command(
      `${CARDANO_PATH}cardano-cli address key-hash \\
          --payment-verification-key-file policy/policy.vkey | tr -d '\n'`
    );
    console.debug(`ℹ︎ Key Hash: '${keyHash}'`);

    writeFileSync(
      path.join(tokenName, "policy", "policy.script"),
      JSON.stringify(
        {
          keyHash,
          type: "sig",
        },
        null,
        2
      )
    );

    command(
      `${CARDANO_PATH}cardano-cli transaction policyid \\
          --script-file ./policy/policy.script > policy/policyID
          `,
      "policy/policyID"
    );

    const utxo = command(`${CARDANO_PATH}cardano-cli query utxo \\
        --address ${address} ${NETWORK} | tail -n1
          `).replace(/ {2,}/g, " ");

    if (utxo.split("\n").length <= 2)
      throw new Error("UTXO Might not be found.");

    const txHash = utxo.split(" ")[0].trim();
    const txIx = utxo.split(" ")[1].trim();
    const lovelace = utxo.split(" ")[2].trim();

    console.debug(`ℹ︎ UTXO: '${utxo}'`);
    console.debug(`ℹ︎ Tx Hash: '${txHash}'`);
    console.debug(`ℹ︎ Tx Ix: '${txIx}'`);
    console.debug(`ℹ︎ Lovelace: '${lovelace}'`);

    let policyId = readFileSync(
      path.join(tokenName, "policy", "policyID"),
      "utf-8"
    ).trim();
    let fee = 30000;
    let output = 0;

    command(
      `${CARDANO_PATH}cardano-cli transaction build-raw \\
          --fee ${fee} \\
          --tx-in ${txHash}#${txIx} \\
          --tx-out ${address}+${output}+"${tokenAmount} ${policyId}.${tokenBase16}" \\
          --mint "${tokenAmount} ${policyId}.${tokenBase16}" \\
          --minting-script-file policy/policy.script \\
          --out-file matx.raw`
    );

    fee = command(
      `${CARDANO_PATH}cardano-cli transaction calculate-min-fee \\
          --tx-body-file matx.raw \\
          --tx-in-count 1 \\
          --tx-out-count 1 \\
          --witness-count 2 \\
          ${NETWORK} \\
          --protocol-params-file protocol.json | cut -d " " -f1`
    ).trim();
    console.debug(`ℹ︎ Fee: '${fee}'`);

    output = lovelace - fee;
    console.debug(`ℹ︎ Output: '${output}'`);

    command(`${CARDANO_PATH}cardano-cli transaction build-raw \\
          --fee ${fee} \\
          --tx-in ${txHash}#${txIx} \\
          --tx-out ${address}+${output}+"${tokenAmount} ${policyId}.${tokenBase16}" \\
          --mint "${tokenAmount} ${policyId}.${tokenBase16}" \\
          --minting-script-file policy/policy.script \\
          --out-file matx.raw`);

    command(`${CARDANO_PATH}cardano-cli transaction sign \\
          --signing-key-file payment.skey \\
          --signing-key-file policy/policy.skey \\
          ${NETWORK} \\
          --tx-body-file matx.raw \\
          --out-file matx.signed`);

    command(
      `${CARDANO_PATH}cardano-cli transaction submit \\
          --tx-file matx.signed \\
          ${NETWORK}`
    );

    utxo = command(
      `${CARDANO_PATH}cardano-cli query utxo \\
          --address ${address} \\
          ${NETWORK}`
    );

    console.debug(`ℹ︎ UTXO: ${utxo}`);

    console.log("✔︎ Last step, register your token.");
  } catch (e) {
    console.error(`✘ ERROR: ${e.message}`);
    process.exit(1);
  }
})();
