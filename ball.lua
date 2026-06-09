physics = require ( "physics" )

Ball = {}
Ball.__index = Ball

function Ball:place( pos )
    local radius = 7
    local ball = {}
    ball['object'] = display.newCircle( pos[1], pos[2], radius )
    ball['object']:setFillColor( 0.3, 0.3, 0.3 )
    physics.addBody(ball['object'], "dynamic", { density=1.0, friction=0, bounce=0.4, radius=7 })
    return ball
end