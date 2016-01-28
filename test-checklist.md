A feature branch may only be merged back to master if the latest commit 
produces expected results in all test scenarios on all test configurations.
Test configurations:
====================
+   Ubuntu 15.10 64bit, NVidia, Firefox
+   Ubuntu 15.10 64bit, NVidia, Chrome
+   Ubuntu 15.10 64bit, NVidia, Opera
+   Ubuntu 15.10 64bit, intel, Firefox
Test scenarios:
===============
+   New game > Piloting mode > Mouse turn around > Mouse fire
+   New game > Piloting mode > Keyboard turn around > Keyboard fire
+   New game > Piloting mode > Joystick turn around > Joystick fire > Joystick throttle control
+   New game > Piloting mode > Increase speed > Change flight mode
+   New game > Piloting mode > Spectator mode > Follow next ship > Follow next ship > Piloting mode
+   New game > Follow next ship > Follow next ship > Follow next ship > ...
+   New game > Follow previous ship > Follow previous ship > Follow next ship > ...
+   New game > Follow next ship / Piloting mode > Set back to free camera
+   New game > Follow next ship > Next view > Next view > ... (check rotating and moving the camera for all views)
+   New game > Piloting mode > Change orientation & speed > Next view > Next view > ... (check rotating and moving the camera for all views)
+   New game > Piloting mode > Change orientation & speed > Set to free camera > Follow player ship > Next view > Next view > ... (check rotating and moving the camera for all views)
+   New game > Piloting mode > Cycle through targets
+   New game > Piloting mode > Change to target view > Cycle through targets
+   New game > Show hitboxes
+   Database > Rotate ship (with the mouse) > Next item > Next item > ...
+   Settings > Set shadows to off > Launch game & test > Set shadows to on > Launch game and test