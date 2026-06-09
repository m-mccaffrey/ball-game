-----------------------------------------------------------------------------------------
--
-- play.lua
--
-----------------------------------------------------------------------------------------

local composer = require( "composer" )
local physics = require("physics" )
local UI = require( "ui" )
local widget = require( "widget" ) 
local map = require( "map" )
local scene = composer.newScene()

--------------------------------------------

-- forward declarations and other locals

-- 'onRelease' event listener for playBtn

function scene:create( event )
	local sceneGroup = self.view
  physics:start()
  local background = Background:init()
  local superBG = Background:superInit()
  local map = Map:build( maps[currentMap] )
  local mapView = map['objects']
  local ui = UI:init()
  
  -- e.g. add display objects to 'sceneGroup', add touch listeners, etc.

	-- display a background image
--	Map:build(titleMenu)
--  UI:init()
	
	-- create/position logo/title image on upper-half of the screen
	
  sceneGroup:insert(superBG)
  sceneGroup:insert(background)
  sceneGroup:insert(mapView)
  sceneGroup:insert(ui)
	-- Called when the scene's view does not exist.
	-- 
	-- INSERT code here to initialize the scene
	-- e.g. add display objects to 'sceneGroup', add touch listeners, etc.

	-- display a background image
	-- Map:build(map1, self.view)
  --UI:init()
	
	-- all display objects must be inserted into group
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
		-- Called when the scene is on screen and is about to move off screen
		--
		-- INSERT code here to pause the scene
		-- e.g. stop timers, stop animation, unload sounds, etc.)
	elseif phase == "did" then
		-- Called when the scene is now off screen
	end	
end

function scene:destroy( event )
  physics.stop()
	local sceneGroup = self.view
	
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