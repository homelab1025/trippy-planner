docker run --rm -it --security-opt seccomp=unconfined \
  -p 8080:8080 \
  -p 5173:5173 \
  -p 5432:5432 \
  -v "$PWD:/workspace" \
  -v ~/.pi/agent:/root/.pi/agent \
  -v /var/run/docker.sock:/var/run/docker.sock \
  pi-sandbox