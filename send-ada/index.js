const { execSync } = require("node:child_process");
const { mkdirSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");

process.env.CARDANO_NODE_SOCKET_PATH = "/tmp/cardano.sock";
const CARDANO_PATH = "../cardano-node-8.0.0-macos/";
const NETWORK = "--testnet-magic 1";
const PREFIX = "..";

// Configurations
const txName = "sendADAData";
const amountToSend = 500000000; // 500 ADA
const receiverAddress =
  "addr_test1qqsvgqea6cmhu086l7gcj7h6hxjq3l3v3dlf94y327mg2ff2xdppcgk5vav8qyngtgee426uyejgy74qhna0hh87v2cqscdr79";

// Functions
function fileExist(filename) {
  try {
    if (filename && statSync(path.join(PREFIX, txName, filename)).isFile()) {
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
    cwd: path.join(PREFIX, txName),
    encoding: "utf-8",
  }).toString();
  console.debug("✔︎ Command executed with success");
  return output.trim();
}

// Main
(async () => {
  try {
    mkdirSync(path.join(PREFIX, txName), { recursive: true });

    command(
      `${CARDANO_PATH}cardano-cli query protocol-parameters \\
      ${NETWORK} \\
      --out-file protocol.json`,
      "protocol.json"
    );

    address = readFileSync(path.join(PREFIX, txName, "payment.addr"));
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
      .map((_) => "+ " + _.trim());

    suffix = secondSection.join(" ");

    console.debug(`ℹ︎ UTXO: '${utxo}'`);
    console.debug(`ℹ︎ Tx Hash: '${txHash}'`);
    console.debug(`ℹ︎ Tx Ix: '${txIx}'`);
    console.debug(`ℹ︎ Lovelace: '${lovelace}'`);
    console.debug(`ℹ︎ Suffix: '${suffix}'`);

    let fee = 0;
    let output = 0;

    command(`${CARDANO_PATH}cardano-cli transaction build-raw \\
    --tx-in ${txHash}#${txIx} \\
    --tx-out ${receiverAddress}+${amountToSend} \\
    --tx-out ${address}+0+"${suffix.slice(1)}" \\
    --invalid-hereafter 0 \\
    --fee 0 \\
    --out-file tx.draft`);

    fee = command(`${CARDANO_PATH}cardano-cli transaction calculate-min-fee \\
    --tx-body-file tx.draft \\
    --tx-in-count 1 \\
    --tx-out-count 2 \\
    --witness-count 1 \\
    --byron-witness-count 0 \\
    ${NETWORK} \\
    --protocol-params-file protocol.json | cut -d " " -f1`).trim();
    console.debug(`ℹ︎ Fee: '${fee}'`);

    const slotNo = command(
      `${CARDANO_PATH}cardano-cli query tip ${NETWORK} | jq .slot`
    );
    console.debug(`ℹ︎ SlotNo: '${slotNo}'`);
    output = parseInt(lovelace) - parseInt(fee) - parseInt(amountToSend);

    command(`${CARDANO_PATH}cardano-cli transaction build-raw \\
    --tx-in ${txHash}#${txIx} \\
    --tx-out ${receiverAddress}+${amountToSend} \\
    --tx-out ${address}+${output}+"${suffix.slice(1)}" \\
    --invalid-hereafter ${parseInt(slotNo) + 200} \\
    --fee ${fee} \\
    --out-file tx.raw`);

    command(`${CARDANO_PATH}cardano-cli transaction sign \\
    --tx-body-file tx.raw \\
    --signing-key-file payment.skey \\
    ${NETWORK} \\
    --out-file tx.signed`);

    command(
      `${CARDANO_PATH}cardano-cli transaction submit \\
          --tx-file tx.signed \\
          ${NETWORK}`
    );
  } catch (e) {
    console.error(`✘ ERROR: ${e.message}`);
    process.exit(1);
  }
})();
