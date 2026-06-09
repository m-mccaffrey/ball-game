local widget = require "widget"
local map = require "map"
require( "colorDefs" )

local UI = {}
UI.__index = UI

UI.labels = { "Debug", "Start", "Records", ""}

UI.ColorButton = {}
UI.ColorButton.__index = ColorButton

function UI.ColorButton:init( id, parent )
  local clrBtn = widget.newButton{
    labelColor = { default={0}, over={128} },
    emboss = false,
    -- Rectangle
    shape = "rect",
    fillColor = { default = colors[id], over=colors[id]},
    width = display.contentWidth/4, 
    height = display.contentHeight/4
  }
  clrBtn.color = colors[id]
  clrBtn.id = id
  clrBtn.anchorX = 0
  clrBtn.anchorY = 0
  clrBtn.x = clrBtn.width * (id - 1)
  clrBtn.y = display.contentHeight-clrBtn.height
  clrBtn.handler = clrBtnHandler
  clrBtn:addEventListener( "touch", touch)
  parent:insert(clrBtn)
  return clrBtn
end

function UI.labelUI()
  magBtn:setLabel('Debug')
  yelBtn:setLabel('Start')
  grnBtn:setLabel('Records')
end

function reset( event )
    if event.phase == "began" then
    rstBtnHandler()
  end
end

function rstBtnHandler()
  if rstBtn then
    composer.removeScene('play')
    composer.gotoScene('play')
    print('reset')
  end
end

function clrBtnHandler( button )
  if bgColor == colors[button.id] then 
      bgColor = { 0.75, 0.75, 0.75 }
      for thisColor in pairs(tempMap) do
        tempMap[thisColor]['object'].isBodyActive = true
      end
    else
      bgColor = colors[button.id]
      for thisColor in pairs(tempMap) do
        print(thisColor)
        if tempMap[thisColor]['tags']['color'] == button.color then
          tempMap[thisColor]['object'].isBodyActive = false
        else
          tempMap[thisColor]['object'].isBodyActive = true
        end
      end
    end
    Map:update()
end

function touch( event )
  print('here')
  if event.phase == "began" then
    clrBtnHandler( event.target )
  end
end

UI.ResetButton = {}
UI.ResetButton.__index = UI.ResetButton

function UI.ResetButton:init( parent )
  local this = widget.newButton{
    labelColor = { default={0.8,0,0}, over={1,1,1} },
    emboss = false,
    shape = "rect",
    fillColor = { default = {0,0,0}, over = {0,0,0} },
    width = display.contentWidth/16, 
    height = display.contentHeight/16
  }
  this.color = nil
  this.anchorX = 0
  this.anchorY = 0
  this.x = display.contentWidth - this.width
  this.y = 0
  this.handler = rstBtnHandler
  this:addEventListener( "touch", reset )
  this:setLabel('X')
  parent:insert(this)
  return this
end


function UI:init(menu)
  local ui = display.newGroup()
  magBtn = UI.ColorButton:init( 1, ui )
  yelBtn = UI.ColorButton:init( 2, ui )
  grnBtn = UI.ColorButton:init( 3, ui )
  cynBtn = UI.ColorButton:init( 4, ui )

  if not menu then
    rstBtn = UI.ResetButton:init( ui )
  else 
    UI.labelUI()
  end
  
  keys = {}
  keys['a'] = magBtn
  keys['j'] = magBtn
  keys['s'] = yelBtn
  keys['k'] = yelBtn
  keys['d'] = grnBtn
  keys['l'] = grnBtn
  keys['f'] = cynBtn
  keys[';'] = cynBtn
  keys['space'] = rstBtn
  
  return ui
end


function onKeyEvent( event )
    if event.phase == "down" and keys[event.keyName] then
      keys[event.keyName].handler(keys[event.keyName])
    end
    -- Print which key was pressed down/up
    local message = "Key '" .. event.keyName .. "' was pressed " .. event.phase
    print( message )
 
    -- If the "back" key was pressed on Android, prevent it from backing out of the app
    if ( event.keyName == "back" ) then
        if ( system.getInfo("platform") == "android" ) then
            return true
        end
    end
 
    -- IMPORTANT! Return false to indicate that this app is NOT overriding the received key
    -- This lets the operating system execute its default handling of the key
    return false
end
 
-- Add the key event listener
Runtime:addEventListener( "key", onKeyEvent )

return UI