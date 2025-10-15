#!/bin/bash
npm run lint && npm run build && npm test -- --watch=false --browsers=ChromeHeadless --progress=false
