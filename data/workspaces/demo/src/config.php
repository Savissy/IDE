<?php

declare(strict_types=1);

const APP_NAME = 'DeFi Insurance Protocol';
const APP_URL = 'http://localhost:8000';
const APP_ENV = 'production';

const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'defi_dapp';
const DB_USER = 'defi_user';
const DB_PASS = 'change_me';
const DB_CHARSET = 'utf8mb4';

const SESSION_NAME = 'defi_session';
const SESSION_LIFETIME = 7200;
const SESSION_SECURE_COOKIE = false;
const SESSION_SAMESITE = 'Lax';

const CSRF_TOKEN_KEY = '_csrf_token';
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW = 900;

const DEFAULT_REDIRECT_AFTER_LOGIN = '/launch.php';
