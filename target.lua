composer = require( "composer" )

currentMap = 1 

Target = {}
Target.__index = Target

score = 0

function Target:place( this )
    score = 0
    local target = {}
    target['tags'] = this[4]
    local radius = 7
    target['object'] = display.newCircle( composer.getScene(composer.getSceneName('current')).view, this[1], this[2], radius )
    target['object'].strokeWidth = 1
    target['object']:setFillColor( 0, 0, 0, 0 )
    target['object']:setStrokeColor( 0, 0, 0 )
    physics.addBody(target['object'], "static", { density=1.0, friction=0, bounce=0, radius=7 })
    target['object'].isSensor = true
    if this[3] == nil then
      target['object']:addEventListener("collision", genericTargetCollision)
    else
      target['object']:addEventListener("collision", this[3] )
    end
    return target
end

function genericTargetCollision( event )
  if event.phase == 'began' then
    event.target:removeSelf()
    score = score + 1
    if not event.target[3] == nil then
    end
  end
  if score == #maps[currentMap]['targets'] then
    timer.performWithDelay(50, nextLevel, 1)
  end
end

function nextLevel()
  composer.removeScene('play')
  currentMap = currentMap + 1
  if currentMap > #maps then
    currentMap = 1
    composer.gotoScene('menu')
  else
    composer.gotoScene('play')
  end
end