# Cardano Utils

I'm learning Cardano basics.

## Utils

- **Minting Native Assets**
  - Simply wrapped cardano-cli commands in NodeJS.
  - Followed this guide: https://developers.cardano.org/docs/native-tokens/minting

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

3. Download `cardano-cli`

> I downloaded the mac binaries and tested it successfully.

Binaries available here: https://github.com/input-output-hk/cardano-node/releases

4. Open the `index.js` and **edit** the **configurations** at the top to **_fit your setup_**.
