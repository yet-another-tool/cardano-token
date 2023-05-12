# Cardano Utils

I'm learning Cardano basics.

## Utils

- **Minting Native Assets**
  - Simply wrapped cardano-cli commands in NodeJS.
  - Followed this guide: https://developers.cardano.org/docs/native-tokens/minting
- **Sending Native Assets**
  - Simply wrapped cardano-cli commands in NodeJS.
  - Followed this guide: https://developers.cardano.org/docs/native-tokens/minting/#sending-token-to-a-wallet
- **Sending ADA to another wallet**
  - Simply wrapped cardano-cli commands in NodeJS.
  - Followed this guide: https://github.com/input-output-hk/cardano-node/blob/8.0.0/doc/reference/building-and-signing-tx.md

## Environment

### Prerequisites

```bash
sudo yum install socat
sudo port install socat
```

### Getting Started

1. Start **Docker** and **cardano node**

```bash
docker run \
    -d \
    --name cardano-preprod \
    -v /cardano/data:/data \
    -v /cardano/ipc/:/ipc \
    -e NETWORK=preprod \
    inputoutput/cardano-node
```

2. Setup **Socat** and connectivity between client and server

> **Required only if** you run your cardano node on a remote machine.

**Server**:

```bash 
sudo firewall-cmd --zone=public --add-port=1234/tcp
sudo socat TCP-LISTEN:1234,fork,reuseaddr UNIX-CONNECT:/cardano/ipc/node.socket
```

**Client**:

> Replace `x.y.z.z` to your server IP.

```bash
socat UNIX-LISTEN:/tmp/cardano.sock,fork,reuseaddr,mode=755 TCP:x.y.z.z:1234 &
```

**OR Using SSH**:

> Run this command on your **client**

```bash
rm /tmp/cardano.sock
ssh -nNT -L /tmp/cardano.sock:/cardano/ipc/node.socket user@x.y.z.z
```

> The user must have _proper permission_ to interact with the `node.socket`

3. Download `cardano-cli`

> I downloaded the mac binaries and tested it successfully.

Binaries available here: https://github.com/input-output-hk/cardano-node/releases

4. Test the connection

```bash
cd cardano-node-8.0.0-macos
./cardano-cli query tip --testnet-magic 1
```

_Expected Output:_

```json
{
  "block": 929002,
  "epoch": 69,
  "era": "Babbage",
  "hash": "5409cad9e713f00ce9d285cbdcf4e4aa6bd8d7de753e23c2cf7bce93d85b9226",
  "slot": 28210953,
  "slotInEpoch": 44553,
  "slotsToEpochEnd": 387447,
  "syncProgress": "100.00"
}
```

5. Open the `index.js` and **edit** the **configurations** at the top to **_fit your setup_**.
