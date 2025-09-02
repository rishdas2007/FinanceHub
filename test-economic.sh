#!/bin/bash

# Start server
NODE_ENV=production PORT=8080 npm start > /tmp/server.log 2>&1 &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 8

echo -e "\nTesting economic calendar endpoint:"
curl -s http://localhost:8080/api/economic-calendar?limit=3 | python3 -m json.tool | head -100

# Kill server
kill $SERVER_PID 2>/dev/null

echo -e "\nTest complete!"