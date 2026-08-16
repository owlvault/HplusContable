@echo off
REM ===================================================================
REM  sales-sync - PUBLICAR en el ERP
REM
REM  Ejecuta primero revisar.bat y valida manifiesto.json.
REM  Este script si escribe en el ERP.
REM
REM  Es seguro repetirlo: cada archivo se identifica por el hash de su
REM  contenido, asi que no se duplica nada.
REM ===================================================================
setlocal
chcp 65001 >nul 2>nul
cd /d "%~dp0"

set "CARPETA=C:\Users\ccarvajalino\OneDrive\H Plus\Comercial"

echo.
echo ==========================================
echo   sales-sync - publicar en el ERP
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado. Instalalo desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "%CARPETA%" (
    echo [ERROR] No se encontro la carpeta:
    echo   %CARPETA%
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\exceljs" (
    echo Instalando dependencias...
    call npm install
    if errorlevel 1 ( pause & exit /b 1 )
)

REM La URL y el token se pueden dejar fijos en variables de entorno del
REM sistema (HPLUS_ERP_URL y HPLUS_SALES_TOKEN) para no teclearlos cada vez.
REM Se piden en una sola linea, sin parentesis: dentro de un bloque if(...)
REM cmd expandiria la variable antes de que set /p la escriba.
if not defined HPLUS_ERP_URL set /p "HPLUS_ERP_URL=URL del ERP (ej. https://erp.hplus.co): "
if not defined HPLUS_SALES_TOKEN set /p "HPLUS_SALES_TOKEN=Token de ingesta: "

if not defined HPLUS_ERP_URL (
    echo [ERROR] Falta la URL del ERP.
    pause
    exit /b 1
)
if not defined HPLUS_SALES_TOKEN (
    echo [ERROR] Falta el token de ingesta.
    pause
    exit /b 1
)

echo.
echo Publicando en %HPLUS_ERP_URL% ...
echo.

node sync.mjs --root "%CARPETA%" --api "%HPLUS_ERP_URL%" --token "%HPLUS_SALES_TOKEN%"
if errorlevel 1 (
    echo.
    echo [ERROR] La publicacion termino con errores. Revisa los mensajes de arriba.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Publicado.
echo ==========================================
echo.
echo Abre el ERP en Ventas ^> Importar para ver el historial de la carga,
echo y en Ventas ^> Propuestas las que quedaron marcadas para revisar.
echo.
pause
