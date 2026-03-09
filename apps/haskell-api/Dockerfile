FROM haskell:9.6.4 AS build

WORKDIR /app

COPY cabal.project /app/
COPY cardano-ide-api.cabal /app/

# Force cabal to use the main Hackage HTTPS repository
RUN mkdir -p /root/.config/cabal && \
    printf "repository hackage.haskell.org\n  url: https://hackage.haskell.org/\n  secure: True\nremote-repo-cache: /root/.cabal/packages\nworld-file: /root/.cabal/world\n" > /root/.config/cabal/config

RUN cabal update && cabal build --only-dependencies -j

COPY src /app/src

RUN cabal build -j

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/dist-newstyle /app/dist-newstyle

RUN set -eux; \
    BIN="$(find /app/dist-newstyle -type f -name cardano-ide-api -perm -111 | head -n 1)"; \
    cp "$BIN" /usr/local/bin/cardano-ide-api

EXPOSE 8080

CMD ["cardano-ide-api"]