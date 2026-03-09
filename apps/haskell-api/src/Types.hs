{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE DeriveGeneric #-}

module Types where

import Data.Aeson
import Data.Text (Text)
import GHC.Generics (Generic)

data OkResp = OkResp
  { okRespValue :: Bool
  } deriving (Show, Generic)

instance ToJSON OkResp where
  toJSON (OkResp okv) = object ["ok" .= okv]

data ItemsResp a = ItemsResp
  { itemsRespValue :: [a]
  } deriving (Show, Generic)

instance ToJSON a => ToJSON (ItemsResp a) where
  toJSON (ItemsResp xs) = object ["items" .= xs]

data ContentResp = ContentResp
  { contentRespValue :: Text
  } deriving (Show, Generic)

instance ToJSON ContentResp where
  toJSON (ContentResp c) = object ["content" .= c]

data JobIdResp = JobIdResp
  { jobIdRespValue :: Text
  } deriving (Show, Generic)

instance ToJSON JobIdResp where
  toJSON (JobIdResp j) = object ["jobId" .= j]

data ImportFile = ImportFile
  { importFilePath :: Text
  , importFileContent :: Text
  } deriving (Show, Generic)

instance ToJSON ImportFile where
  toJSON (ImportFile p c) = object ["path" .= p, "content" .= c]

instance FromJSON ImportFile where
  parseJSON = withObject "ImportFile" $ \o ->
    ImportFile <$> o .: "path" <*> o .: "content"

data ImportResp
  = ImportOk [ImportFile]
  | ImportErr Text
  deriving (Show, Generic)

instance ToJSON ImportResp where
  toJSON (ImportOk fs) = object ["ok" .= True, "files" .= fs]
  toJSON (ImportErr e) = object ["ok" .= False, "error" .= e]

data WorkspaceBackup = WorkspaceBackup
  { backupWorkspace :: Text
  , backupFiles :: [ImportFile]
  } deriving (Show, Generic)

instance ToJSON WorkspaceBackup where
  toJSON (WorkspaceBackup w fs) = object
    [ "workspace" .= w
    , "files" .= fs
    ]

instance FromJSON WorkspaceBackup where
  parseJSON = withObject "WorkspaceBackup" $ \o ->
    WorkspaceBackup <$> o .: "workspace" <*> o .: "files"