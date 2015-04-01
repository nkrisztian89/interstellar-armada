A feature branch may only be merged back to master if the latest commit 
produces expected results in all test scenarios on all test configurations.
Test configurations:
====================
+   Ubuntu 14.10 64bit, NVidia, Firefox
+   Ubuntu 14.10 64bit, NVidia, Chrome
+   Ubuntu 14.10 64bit, NVidia, Opera
+   Ubuntu 14.10 64bit, intel, Firefox
+   Mac OS X 10.10 64bit, NVidia, Safari
+   Mac OS X 10.10 64bit, NVidia, Firefox
+   Mac OS X 10.10 64bit, NVidia, Chrome
+   Ubuntu Phone 14.10 armv7, Ubuntu browser
Test scenarios:
===============
+   New game > Piloting mode > Mouse turn around > Mouse fire
+   New game > Piloting mode > Keyboard turn around > Keyboard fire
+   New game > Piloting mode > Increase speed > Change flight mode
+   New game > Piloting mode > Spectator mode > Follow next ship > Follow next ship > Piloting mode
+   New game > Follow next ship > Follow next ship > Follow next ship > ...
+   New game > Follow next ship > Next view > Next view > ...
+   New game > Show hitboxes
+   Database > Rotate ship > Next item > Next item > ...
+   Settings > Set shadows to off > Launch game & test > Set shadows to on > Launch game and test