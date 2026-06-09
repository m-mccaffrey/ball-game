shape = require( "shape" )
ball = require( "ball" )
target = require( "target" )
require( "mapData" )
require( "colorDefs" )


currentMap = 6

tempMap = {}
  
Map = {}
Map.__index = Map
  
function Map:update()
  background:setFillColor( unpack(bgColor) )
end

function Map:build( map )
  print("Building Map")
  print(map)
  local thisMap = {}
  thisMap['objects'] = display.newGroup()
  
  -- Clear old temp map
  for thisShape in pairs(tempMap) do
    table.remove(tempMap, thisShape)
  end
  
  -- Add shapes
  for map,thisShape in pairs(map['shapes']) do
    local shape = Shape:create(thisShape)
    table.insert(tempMap, shape)
    thisMap['objects']:insert(shape['object'])
    
  end
  
  -- Add targets
  for thisTarget in pairs(map['targets']) do
    newTarget = Target:place( map['targets'][thisTarget] )
    thisMap['objects']:insert(newTarget['object'])
  end
  
  -- Add ball(s?)
  for thisBall in pairs(map['balls']) do
    b = Ball:place( map['balls'][thisBall])
    thisMap['objects']:insert( b['object'] )
  end
  
  -- Create floor
  local floor = display.newRect( display.contentCenterX, 3*display.contentHeight / 4, display.contentWidth, 1 )
  floor:setFillColor( 0, 0, 0 )
  thisMap['objects']:insert( floor )
  physics.addBody(floor, "static", chain)
  
  Map:update()
  return thisMap
end