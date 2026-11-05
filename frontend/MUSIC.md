# MUSIC AND SOUNDTRACK

This README documents the music and sound effects currently used by the SURI
frontend, their source credits, and how playback is controlled.

The active audio inventory contains **4 background music tracks**, **1 recorded
sound effect**, and **11 generated battle sound cues**. Two additional music files
are stored locally but are not assigned to any page.

## Music

| File | Track and creator | Where used | Source |
| --- | --- | --- | --- |
| [TempleOfWater_MainBG.mp3](public/sounds/music/TempleOfWater_MainBG.mp3) | **Temple of water** by [Dummy_Daniel](https://pixabay.com/users/dummy_daniel-51999828/) | Dashboard, Topics, Progress, History Logs, Playground, Calculator | [Pixabay](https://pixabay.com/music/video-games-temple-of-water-531801/) |
| [Underworld_LessonBG.mp3](public/sounds/music/Underworld_LessonBG.mp3) | **異界の地 Underworld** by [nojisuma](https://pixabay.com/users/nojisuma-23737290/) | Lessons | [Pixabay](https://pixabay.com/music/ambient-%E7%95%B0%E7%95%8C%E3%81%AE%E5%9C%B0-underworld-263012/) |
| [Suspicion_QuizBG.mp3](public/sounds/music/Suspicion_QuizBG.mp3) | **疑惑 suspicion** by [nojisuma](https://pixabay.com/users/nojisuma-23737290/) | Quiz | [Pixabay](https://pixabay.com/music/upbeat-%E7%96%91%E6%83%91-suspicion-295148/) |
| [Observatory_PracticeBG.mp3](public/sounds/music/Observatory_PracticeBG.mp3) | **展望台 Observatory** by [nojisuma](https://pixabay.com/users/nojisuma-23737290/) | Practice | [Pixabay](https://pixabay.com/music/upbeat-%E5%B1%95%E6%9C%9B%E5%8F%B0-observatory-278303/) |
| [MagicalOvertureClassicalSymphonicLoop_DiagnosticBG.mp3](public/sounds/music/MagicalOvertureClassicalSymphonicLoop_DiagnosticBG.mp3) | **Magical Overture - Classical Symphonic Loop** by [Sonican](https://pixabay.com/users/sonican-38947841/) | Diagnostic | [Pixabay](https://pixabay.com/music/modern-classical-magical-overture-classical-symphonic-loop-342008/) |
| [Legend_ResultsBG.mp3](public/sounds/music/Legend_ResultsBG.mp3) | **Legend** by [Ebunny](https://pixabay.com/users/ebunny-22480773/) | Results, Diagnostic Gap Results | [Pixabay](https://pixabay.com/music/folk-legend-357820/) |

## Sound effects

| File | Effect and creator | Where used | Source |
| --- | --- | --- | --- |
| [book_carousel.mp3](public/sounds/sfx/book_carousel.mp3) | **Swoosh 1** by [AleXZavesa](https://pixabay.com/users/alexzavesa-24262182/) | Changing books in Topics | [Pixabay](https://pixabay.com/sound-effects/swoosh-1-463607/) |

Practice and Diagnostic also use 11 generated battle sound cues.

## Playback

Music loops and keeps its position when navigating between pages using the same
track. Master, Music, and Sound effects volume are controlled in **Settings > Audio
settings**. Login and Registration have no BGM.

## Asset locations

- Music: `public/sounds/music/`
- Recorded SFX: `public/sounds/sfx/`
