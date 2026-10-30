@echo off
title Torneos
cd /d "%~dp0"
start "" http://localhost:4173
node servidor.mjs 4173
