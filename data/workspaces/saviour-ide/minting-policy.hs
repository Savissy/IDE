{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, FilePath, putStrLn)
import qualified Prelude as P
import qualified Data.ByteString.Short as SBS
import qualified Data.ByteString.Lazy as LBS
import qualified Codec.Serialise as Serialise

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

import qualified Cardano.Api as C

--------------------------------------------------------------------------------
-- Simple minting policy
--------------------------------------------------------------------------------

{-# INLINABLE mkPolicy #-}
mkPolicy :: () -> ScriptContext -> Bool
mkPolicy _ _ = True

policy :: MintingPolicy
policy = mkMintingPolicyScript
  $$(PlutusTx.compile [|| \_ -> Scripts.wrapMintingPolicy mkPolicy ||])

plutusScript :: PlutusScript
plutusScript = unMintingPolicyScript policy

main :: IO ()
main = putStrLn "Minting policy template created."
