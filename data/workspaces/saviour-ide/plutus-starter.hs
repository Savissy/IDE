{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE TypeApplications #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Main where

import Prelude (IO, putStrLn)
import qualified Prelude as P

import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

--------------------------------------------------------------------------------
-- Basic starter module
--------------------------------------------------------------------------------

{-# INLINABLE helloCardano #-}
helloCardano :: BuiltinByteString
helloCardano = "Hello, Cardano from Plutus Starter"

main :: IO ()
main = do
  putStrLn "Plutus Starter template created successfully."
