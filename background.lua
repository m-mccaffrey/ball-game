Background = {}
Background.__index = Background

function Background:superInit()
  display.setDefault('background', 0.6,0.6,0.6)
  superBG = display.newImage('backdrop.png',display.contentCenterX,display.contentCenterY)
  return superBG
end

function Background:init()
  
  bgColor = ({1, 1, 1, 1})
  background = display.newRect(0,0,display.contentWidth, display.contentHeight)
  background.anchorX = 0
  background.anchorY = 0
  background.x = 0 
  background.y = 0
  background.alpha = 1
  return background
end