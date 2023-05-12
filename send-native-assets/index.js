const { execSync } = require("node:child_process");
const { mkdirSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");

process.env.CARDANO_NODE_SOCKET_PATH = "/tmp/cardano.sock";
const CARDANO_PATH = "../cardano-node-8.0.0-macos/";
const NETWORK = "--testnet-magic 1";
const PREFIX = "..";

// Configurations
const tokenName = "3NGL";
const totalHoldTokens = 80000;
const amountToSend = 10000;
const receiverAddress =
  "addr_test1qqsvgqea6cmhu086l7gcj7h6hxjq3l3v3dlf94y327mg2ff2xdppcgk5vav8qyngtgee426uyejgy74qhna0hh87v2cqscdr79";
const receiverOutput = 2000000; // 2 ADA

// Functions
function fileExist(filename) {
  try {
    if (filename && statSync(path.join(PREFIX, tokenName, filename)).isFile()) {
      console.debug(`✘ Command skipped`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function command(cmd, check = null) {
  if (fileExist(check)) return;
  let output = execSync(cmd, {
    cwd: path.join(PREFIX, tokenName),
    encoding: "utf-8",
  }).toString();
  console.debug("✔︎ Command executed with success");
  return output.trim();
}

// Main
(async () => {
  try {
    mkdirSync(path.join(PREFIX, tokenName), { recursive: true });

    tokenBase16 = command(`echo "${tokenName}" | xxd -ps | tr -d '\n'`);
    console.debug(`ℹ︎ Token Base16 encoding: '${tokenBase16}'`);

    address = readFileSync(path.join(PREFIX, tokenName, "payment.addr"));
    console.debug(`ℹ︎ Address: '${address}'`);

    const utxo = command(`${CARDANO_PATH}cardano-cli query utxo \\
        --address ${address} ${NETWORK} | tail -n1
          `).replace(/ {2,}/g, " ");

    if (utxo.split("\n").length !== 1)
      throw new Error("UTXO Might not be found.");

    const firstSection = utxo.split("lovelace")[0];

    let suffix = "";
    const txHash = firstSection.split(" ")[0].trim();
    const txIx = firstSection.split(" ")[1].trim();
    const lovelace = firstSection.split(" ")[2].trim();

    const secondSection = utxo
      .split("+")
      .slice(1, -1)
      .map((_) => "+ " + _.trim())
      .filter((_) => !new RegExp("\\." + tokenBase16).test(_));

    suffix = secondSection.join(" ");

    console.debug(`ℹ︎ UTXO: '${utxo}'`);
    console.debug(`ℹ︎ Tx Hash: '${txHash}'`);
    console.debug(`ℹ︎ Tx Ix: '${txIx}'`);
    console.debug(`ℹ︎ Lovelace: '${lovelace}'`);
    console.debug(`ℹ︎ Suffix: '${suffix}'`);

    let policyId = readFileSync(
      path.join(PREFIX, tokenName, "policy", "policyID"),
      "utf-8"
    ).trim();
    let fee = 0;
    let output = 0;

    command(`${CARDANO_PATH}cardano-cli transaction build-raw \\
      --fee ${fee} \\
      --tx-in ${txHash}#${txIx} \\
      --tx-out ${receiverAddress}+${receiverOutput}+"${amountToSend} ${policyId}.${tokenBase16}" \\
      --tx-out ${address}+${output}+"${
      totalHoldTokens - amountToSend
    } ${policyId}.${tokenBase16} ${suffix}" \\
      --out-file send_to_matx.raw`);

    fee = command(
      `${CARDANO_PATH}cardano-cli transaction calculate-min-fee \\
          --tx-body-file send_to_matx.raw \\
          --tx-in-count 1 \\
          --tx-out-count 1 \\
          --witness-count 2 \\
          ${NETWORK} \\
          --protocol-params-file protocol.json | cut -d " " -f1`
    ).trim();
    console.debug(`ℹ︎ Fee: '${fee}'`);

    output = parseInt(lovelace) - parseInt(fee) - parseInt(receiverOutput);
    console.debug(`ℹ︎ Output: '${output}'`);

    command(`${CARDANO_PATH}cardano-cli transaction build-raw \\
      --fee ${fee} \\
      --tx-in ${txHash}#${txIx} \\
      --tx-out ${receiverAddress}+${receiverOutput}+"${amountToSend} ${policyId}.${tokenBase16}" \\
      --tx-out ${address}+${output}+"${
      totalHoldTokens - amountToSend
    } ${policyId}.${tokenBase16} ${suffix}" \\
      --out-file send_to_matx.raw`);

    command(`${CARDANO_PATH}cardano-cli transaction sign \\
          --signing-key-file payment.skey \\
          --signing-key-file policy/policy.skey \\
          ${NETWORK} \\
          --tx-body-file send_to_matx.raw \\
          --out-file send_to_matx.signed`);

    command(
      `${CARDANO_PATH}cardano-cli transaction submit \\
          --tx-file send_to_matx.signed \\
          ${NETWORK}`
    );
  } catch (e) {
    console.error(`✘ ERROR: ${e.message}`);
    process.exit(1);
  }
})();
