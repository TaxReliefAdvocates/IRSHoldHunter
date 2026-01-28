#!/bin/bash
# List all extensions with DirectNumbers that can be added for concurrent calling

TOKEN=$(redis-cli GET "config:rc_access_token")

echo "=================================================="
echo "EXTENSIONS WITH DIRECT NUMBERS (Available for concurrent calls)"
echo "=================================================="
echo ""

curl -s -H "Authorization: Bearer $TOKEN" \
"https://platform.ringcentral.com/restapi/v1.0/account/~/phone-number?perPage=100" | \
jq -r '[.records[] | select(.usageType == "DirectNumber" and .extension.extensionNumber != null)] | 
    group_by(.extension.id) | 
    map({id: .[0].extension.id, ext: .[0].extension.extensionNumber, name: .[0].extension.name, numbers: (map(.phoneNumber) | join(", "))}) | 
    sort_by(.ext | tonumber) |
    .[] | "\(.id) | Ext \(.ext) | \(.name) | \(.numbers)"'

echo ""
echo "=================================================="
echo "CURRENTLY CONFIGURED IN .env"
echo "=================================================="
echo ""
grep "HOLD_EXTENSION_IDS" "$(dirname "$0")/../.env"

echo ""
echo "=================================================="
echo "TO ADD MORE EXTENSIONS:"
echo "=================================================="
echo "1. Copy extension IDs from the list above"
echo "2. Edit server/.env"
echo "3. Add IDs to HOLD_EXTENSION_IDS (comma-separated)"
echo "4. Restart the server"
echo "5. Click 'Full Sync' in the UI"
echo ""
echo "Example for 20 concurrent calls:"
echo "HOLD_EXTENSION_IDS=62378666006,62449168006,62450601006,62503058006,62541822006,62547228006,62575829006,62576452006,62582051006,62583020006,62696978006,62723045006,62773073006,62819043006,62822868006,62822870006,62822872006,62822876006,62824164006,62831487006"
echo ""
