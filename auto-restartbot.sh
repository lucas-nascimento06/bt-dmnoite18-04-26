#!/bin/bash
BOT_NAME="damasnight-bot"
BOT_DIR="$HOME/bt-dmnoite18-04-26"

while true; do
    if ping -c 1 google.com &> /dev/null; then
        if ! pm2 list | grep -q "$BOT_NAME"; then
            echo "🌐 Internet ativa e bot não encontrado. Reiniciando..."
            cd "$BOT_DIR" || exit
            pm2 start bot.js --name "$BOT_NAME" --update-env --restart-delay 5000 --max-restarts 1000
            pm2 save
        fi
    else
        echo "⚠️ Sem conexão com a internet..."
    fi
    sleep 30
done
