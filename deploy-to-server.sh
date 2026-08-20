#!/bin/bash
set -e

npm run build

rm -rf ../moduluxe-designer-backend/designer/static/designer/distrib
mkdir -p ../moduluxe-designer-backend/designer/static/designer/distrib
cp -r dist/* ../moduluxe-designer-backend/designer/static/designer/distrib/

mkdir -p ../moduluxe-designer-backend/designer/templates/designer
cp dist/index.html ../moduluxe-designer-backend/designer/templates/designer/index.html

echo "Moduluxe Designer deployed."