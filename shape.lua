physics = require( "physics" )
bodySeparator = require ( "bodySeparator" )
require( "composer" )

Shape = {}
Shape.__index = Shape

function Shape:create( params )
  local this = {}
  this['tags'] = {}
  this['tags']['color'] = params[1]
  if params[2] == 'rect' then
    this['object'] = display.newRect( params[3], params[4], params[5], params[6] )
    this['object']:setFillColor( unpack(params[1]) )
    physics.addBody(this['object'], "static")
  elseif params[2] == 'poly' then 
    this['object'] = display.newPolygon( params[3], params[4], params[5])
    this['object']:setFillColor( unpack(params[1]) )
    local edgechain = {}
    for k,v in pairs(params[5]) do
      table.insert(edgechain, v-params[4-k%2])
      print(k,k%2,edgechain[k])
    end 
    physics.addBody(this['object'], "static", 
      {
          chain=edgechain,
          connectFirstAndLastChainVertex = true
      }
    )
--    bodySeparator.addNonConvexBody(this['object'], {bodyType="static", shape = params[5]})
    
  end
  return this
end

function getCollisionShape( cx, cy, pointList )
  print('getting collision shape')
  print(cx, " " , cy)
  vertices = {}
  i = 0
  for list,point in pairs(pointList) do
    vertex = 0
    if i % 2 == 0 then
      vertex = point - cx
      table.insert(vertices, vertex)
      print("x = ", vertex)
    else
      vertex = point - cy
      table.insert(vertices, vertex)
      print("y = ", vertex)
    end
    i = i + 1
  end
  return vertices
end

--130,360,
--0,360,
--0,250

-- 65, 305
  
