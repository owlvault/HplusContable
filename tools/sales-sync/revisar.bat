@echo off
REM ===================================================================
REM  sales-sync - REVISAR (no escribe nada en el ERP)
REM
REM  Recorre la carpeta Comercial, extrae precios y costos unitarios y
REM  escribe manifiesto.json para que lo revises antes de publicar.
REM
REM  Doble clic para ejecutar.
REM  Si tu carpeta esta en otra ruta, cambia la linea CARPETA de abajo.
REM ===================================================================
setlocal
chcp 65001 >nul 2>nul
cd /d "%~dp0"

set "CARPETA=C:\Users\ccarvajalino\OneDrive\H Plus\Comercial"

echo.
echo ==========================================
echo   sales-sync - revision (modo dry-run)
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado.
    echo Instalalo desde https://nodejs.org ^(version 20 o superior^) y vuelve a intentar.
    echo.
    pause
    exit /b 1
)

if not exist "%CARPETA%" (
    echo [ERROR] No se encontro la carpeta:
    echo   %CARPETA%
    echo.
    echo Abre este archivo con el Bloc de notas y corrige la linea que empieza por SET CARPETA=
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\exceljs" (
    echo Instalando dependencias por primera vez. Esto tarda un minuto...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
    echo.
)

echo Leyendo: %CARPETA%
echo.

node sync.mjs --root "%CARPETA%" --dry-run --out "manifiesto.json" --verbose
if errorlevel 1 (
    echo.
    echo [ERROR] El sincronizador termino con errores. Revisa los mensajes de arriba.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Listo. No se escribio nada en el ERP.
echo ==========================================
echo.
echo Resultado en: %~dp0manifiesto.json
echo.
echo Revisa que las lineas, precios y costos coincidan con tus modelos.
echo Cuando cuadre, ejecuta publicar.bat
echo.
pause
