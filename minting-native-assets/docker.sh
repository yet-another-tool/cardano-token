#!/bin/bash

# Start a ubuntu with the current working directory as a volume.
docker run -it --rm -v $(pwd):/data --entrypoint /bin/bash ubuntu:latest