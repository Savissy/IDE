{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Jobs
  ( startCompile
  , appendLog
  , streamLogs
  ) where

import Control.Concurrent (threadDelay)
import Data.Aeson (encode, object, (.=))
import qualified Data.ByteString.Builder as BB
import qualified Data.ByteString.Lazy as LBS
import qualified Data.Text as T
import Data.Text (Text)
import System.Random (randomIO)
import Network.Wai (Response, responseStream)
import Network.HTTP.Types (status200)
import Data.Time.Clock.POSIX (getPOSIXTime)

randomHex :: IO Text
randomHex = do
  (n :: Int) <- randomIO
  pure (T.pack (take 16 (show (abs n) ++ repeat '0')))

startCompile :: Text -> IO Text
startCompile _project = do
  jobId <- randomHex
  pure jobId

appendLog :: Text -> Text -> IO ()
appendLog _jobId _line = pure ()

streamLogs :: Text -> IO Response
streamLogs _jobId = do
  pure $ responseStream status200
    [ ("Content-Type", "text/event-stream")
    , ("Cache-Control", "no-cache")
    , ("Connection", "keep-alive")
    , ("X-Accel-Buffering", "no")
    ]
    (\write flush -> do
        let loop :: Int -> IO ()
            loop lastPing = do
              now <- round <$> getPOSIXTime

              whenFirst lastPing $ do
                let payload = encode $ object ["line" .= ("[job] started" :: Text)]
                write (BB.string8 "event: log\n")
                write (BB.string8 "data: ")
                write (BB.lazyByteString payload)
                write (BB.string8 "\n\n")
                flush

              if now - lastPing >= 10
                then do
                  write (BB.string8 "event: ping\n")
                  write (BB.string8 "data: {}\n\n")
                  flush
                  threadDelay 250000
                  loop now
                else do
                  threadDelay 250000
                  loop lastPing

        loop 0
    )

whenFirst :: Int -> IO () -> IO ()
whenFirst n action =
  if n == 0 then action else pure ()