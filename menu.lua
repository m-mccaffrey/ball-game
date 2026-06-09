-----------------------------------------------------------------------------------------
--
-- menu.lua
--
-----------------------------------------------------------------------------------------

local composer = require( "composer" )
local physics = require("physics" )
local widget = require( "widget" ) 
local scene = composer.newScene()
local UI = require( "ui" )
local background = require( "background" )
local map = require( "map" )
require( "mapData" )

--------------------------------------------

-- forward declarations and other locals

-- 'onRelease' event listener for playBtn


function scene:create( event )
  local sceneGroup = self.view
	-- Called when the scene's view does not exist.
	-- 
	-- INSERT code here to initialize the scene
  physics.start()
  local background = Background:init()
  local superBG = Background:superInit()
  local map = Map:build( titleMenu )
  local mapView = map['objects']
  local ui = UI:init('menu')
  UI.resetButton = {}
  -- e.g. add display objects to 'sceneGroup', add touch listeners, etc.

	-- display a background image
  --physics:start()
--	Map:build(titleMenu)
--  UI:init()
	
	-- create/position logo/title image on upper-half of the screen
	local myText = display.newEmbossedText( "Title", display.contentCenterX, 75, native.systemFont, 36   )
  myText:setFillColor( 0, 0, 0, 1)

  sceneGroup:insert(superBG)
  sceneGroup:insert(background)
  sceneGroup:insert(mapView)
  sceneGroup:insert(ui)
  sceneGroup:insert(myText)
end

function scene:show( event )
	local sceneGroup = self.view
	local phase = event.phase
	
	if phase == "will" then
		-- Called when the scene is still off screen and is about to move on screen
	elseif phase == "did" then
		-- Called when the scene is now on screen
		-- 
		-- INSERT code here to make the scene come alive
		-- e.g. start timers, begin animation, play audio, etc.
	end	
end

function scene:hide( event )
	local sceneGroup = self.view
	local phase = event.phase
	
	if event.phase == "will" then
    -- physics.stop()
    
		-- Called when the scene is on screen and is about to move off screen
		--
		-- INSERT code here to pause the scene
		-- e.g. stop timers, stop animation, unload sounds, etc.)
	elseif phase == "did" then
		-- Called when the scene is now off screen
	end	
end

function scene:destroy( event )
	local sceneGroup = self.view
  physics.stop()
	
	-- Called prior to the removal of scene's "view" (sceneGroup)
	-- 
	-- INSERT code here to cleanup the scene
	-- e.g. remove display objects, remove touch listeners, save state, etc.
	
end

---------------------------------------------------------------------------------

-- Listener setup
scene:addEventListener( "create", scene )
scene:addEventListener( "show", scene )
scene:addEventListener( "hide", scene )
scene:addEventListener( "destroy", scene )

-----------------------------------------------------------------------------------------

return scene