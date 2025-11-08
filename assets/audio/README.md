# Required Audio Files

This directory should contain the following audio files:

## Required Files

1. **splash.wav** - Water splash sound effect
   - Played when bobber hits water during cast
   - Played when fish breaks water during catch
   - Format: WAV

2. **reel_clicks.wav** - Reel clicking/ratcheting sound
   - Played every ~0.35 seconds while reeling
   - Positioned at rod tip for 3D spatial audio
   - Format: WAV

3. **tug.wav** - Fish tug/pull sound effect
   - Played during fish tugs when fighting
   - Positioned at bobber position
   - Random playback rate variation (1.0 to 1.2) for variety
   - Format: WAV

## Where to Get These Sounds

### Free Sound Effects:
1. **Freesound.org** (free account required): https://freesound.org
   - Search for "water splash", "reel click", "fishing line tug"
   
2. **Zapsplat** (free with attribution): https://www.zapsplat.com
   - Search for fishing-related sounds
   
3. **Pixabay** (free, no attribution needed): https://pixabay.com/sound-effects
   - Search for "splash", "click", "fishing"
   
4. **Mixkit** (free): https://mixkit.co/free-sound-effects
   - Various sound effects including water sounds

### Generate Procedural Sounds:
You can also use online audio generators or audio editing software to create simple:
- Splash: White noise with low-pass filter and envelope
- Reel: Metallic click/tick sounds
- Tug: Short sharp sound with decay

## Note
If these files are missing, the application will still run but without spatial audio effects. The procedural SoundManager will still provide basic sound effects as fallback.










