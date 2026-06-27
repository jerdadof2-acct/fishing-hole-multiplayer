# Cortez Backwaters — Location Design Brief

## Overview

Cortez Backwaters is a warm, shallow-water fishing location inspired by Cortez, Florida. It should capture the feeling of old Florida coastal fishing: mangrove shorelines, weathered docks, oyster beds, seagrass flats, working boats, and calm Gulf water.

This location is personal to the game’s creator and should feel authentic rather than like a generic tropical fishing area. It should resemble the waters around a small historic fishing village where anglers can catch speckled seatrout, flounder, sheepshead, snook, redfish, and occasionally encounter a legendary tarpon.

## Location Identity

| Field | Value |
| --- | --- |
| **Location name** | Cortez Backwaters |
| **Region** | Gulf Coast of Florida |
| **Environment type** | Inshore saltwater, mangrove estuary, shallow coastal flats |
| **Overall mood** | Warm, peaceful, nostalgic, slightly adventurous |
| **Difficulty level** | Intermediate to advanced |
| **Legendary catch** | Tarpon — “The Silver King of Cortez” |

## Location Description

Use this text when introducing the location:

> **Cortez Backwaters**  
> Weathered docks, twisting mangroves, oyster bars, and warm Gulf tides make these old Florida waters a paradise for anglers. The fish know every piling, grass bed, and hidden channel—but somewhere beneath the surface, the legendary Silver King is waiting.

## Visual Environment

The location should feel like an authentic Florida fishing village and backwater estuary.

### Main scenery

- Shallow blue-green or tea-colored coastal water
- Mangrove trees growing along the shoreline
- Exposed mangrove roots near the water
- Seagrass visible beneath shallow areas
- Oyster bars and small patches of exposed shells
- Weathered wooden docks and pilings
- Old fishing boats or shrimp boats in the distance
- Crab traps, ropes, buoys, and dock equipment
- Pelicans resting on posts
- White egrets near the shoreline
- Small baitfish occasionally breaking the surface
- Distant low coastal buildings rather than a modern city skyline
- Warm sunlight and humid Florida atmosphere

### Water appearance

The water should be calmer than an offshore location but should not look completely still.

Include:

- Gentle tidal movement
- Small waves against dock pilings
- Light reflections from the sun
- Occasional baitfish ripples
- Small wakes from distant boats
- Muddy or sandy patches visible in shallow water
- Darker channels where larger fish may travel

### Time and lighting

The preferred lighting is early morning or late afternoon.

Possible effects:

- Warm golden sunlight
- Long shadows from docks and mangroves
- Light mist over distant water
- Orange and pink sky reflections
- Subtle movement in clouds
- Occasional birds flying overhead

## Core Fish Lineup

The location should initially contain six main fish species.

### 1. Speckled Seatrout

- **Rarity:** Common
- **Difficulty:** Easy to moderate
- **Behavior:** Quick bites followed by short bursts of movement

**Visual design:**

- Silver body
- Greenish or bluish back
- Numerous dark round spots
- Yellowish fins
- Large mouth
- Cheerful but alert expression

The fish should look recognizable as a speckled seatrout while still matching the colorful cartoon art style used throughout the game.

### 2. Southern Flounder

- **Rarity:** Common
- **Difficulty:** Moderate
- **Behavior:** Heavy initial pull followed by low side-to-side movement

**Visual design:**

- Flat oval body
- Both eyes positioned on the upper side
- Brown, tan, and sandy coloring
- Dark spots or mottled camouflage
- Wide sideways mouth
- Slightly confused or goofy expression

The flounder should look intentionally unusual and funny without losing its recognizable flatfish shape.

### 3. Sheepshead

- **Rarity:** Uncommon
- **Difficulty:** Moderate
- **Behavior:** Subtle bite followed by strong movement toward dock pilings

**Visual design:**

- Silver or light gray body
- Five to seven dark vertical bars
- Tall body shape
- Strong dorsal spines
- Noticeable human-like front teeth
- Mischievous expression

The teeth should be visible because they are one of the fish’s most recognizable features.

### 4. Redfish

- **Rarity:** Rare
- **Difficulty:** Hard
- **Behavior:** Strong steady runs with powerful turns

**Visual design:**

- Bronze, copper, and reddish body
- Light silver or cream underside
- One prominent black spot near the base of the tail
- Broad shoulders
- Strong tail
- Confident, powerful expression

Large redfish should feel heavy and difficult to control.

### 5. Snook

- **Rarity:** Trophy
- **Difficulty:** Very hard
- **Behavior:** Fast runs toward mangroves and docks, sudden direction changes, occasional surface jump

**Visual design:**

- Long silver body
- Olive or dark green back
- Thick black lateral stripe running from head to tail
- Yellowish fins
- Large upward-facing mouth
- Sleek, confident expression

Snook should be one of the most desirable regular catches in the location.

### 6. Tarpon

- **Rarity:** Legendary
- **Difficulty:** Legendary
- **Title:** The Silver King of Cortez
- **Behavior:** Extremely powerful runs, multiple high jumps, violent head shakes, and large splashes

**Visual design:**

- Massive silver body
- Oversized reflective scales
- Dark blue-green back
- Large upward-facing mouth
- Long dorsal fin ray
- Powerful forked tail
- Regal but intimidating expression

The tarpon should be significantly larger than every other fish in Cortez Backwaters. Its introduction, fight, and catch sequence should feel like a major event.

## Suggested Catch Distribution

Use these values as a starting point and adjust during balancing:

```javascript
const cortezBackwatersFish = [
  {
    id: "speckled_seatrout",
    name: "Speckled Seatrout",
    rarity: "common",
    spawnWeight: 34
  },
  {
    id: "southern_flounder",
    name: "Southern Flounder",
    rarity: "common",
    spawnWeight: 25
  },
  {
    id: "sheepshead",
    name: "Sheepshead",
    rarity: "uncommon",
    spawnWeight: 18
  },
  {
    id: "redfish",
    name: "Redfish",
    rarity: "rare",
    spawnWeight: 12
  },
  {
    id: "snook",
    name: "Snook",
    rarity: "trophy",
    spawnWeight: 8
  },
  {
    id: "tarpon",
    name: "Tarpon",
    rarity: "legendary",
    spawnWeight: 3
  }
];
```

The legendary tarpon spawn rate may need to be reduced further depending on how often the player fishes in each location.

## Fish Fight Personalities

Each fish should feel different during the fishing sequence.

### Speckled seatrout

- Quick bite
- Light zigzag movement
- Short fight
- Occasional small jump

### Flounder

- Delayed or subtle bite
- Feels heavy rather than fast
- Stays low in the water
- Pulls sideways
- Rarely jumps

### Sheepshead

- Small nibbling bite
- Sudden strong pull
- Attempts to reach dock pilings
- Short but difficult fight

### Redfish

- Powerful first run
- Wide sweeping turns
- Strong steady resistance
- Large wake near the surface

### Snook

- Violent strike
- Fast directional changes
- Runs toward structure
- May jump near the dock
- Requires careful line tension

### Tarpon

- Dramatic strike
- Large explosion at the surface
- Multiple full-body jumps
- Strong head shakes
- Long runs
- Large splash and camera shake
- Longest fight in the location

## Legendary Tarpon Encounter

The tarpon should not feel like an ordinary random catch.

**Possible requirements before it becomes available:**

- Catch every other Cortez species at least once
- Catch a trophy-sized snook
- Discover the location’s hidden object
- Use a special bait
- Fish during a specific time of day
- Complete a Cortez fishing challenge

**When the tarpon bites:**

- Music changes
- Water erupts around the bobber
- Camera briefly zooms toward the strike
- A large silver shape appears under the surface
- The tarpon immediately jumps
- A special legendary fight meter appears

**Catch message:**

> **LEGENDARY CATCH!**  
> The Silver King has ruled these backwaters for years—and Halley finally landed him.

## Hidden Object or Secret

A fitting hidden object for Cortez Backwaters would be an old fishing-related item.

**Best options:**

- Weathered crab trap
- Old wooden fishing sign
- Lost tackle box
- Rusted boat anchor
- Antique fishing reel
- Message in a bottle
- Sunken skiff
- Old shrimp boat bell

**Recommended choice:** The Lost Cortez Tackle Box

The player occasionally sees a faint metallic glint near an oyster bed or beneath an old dock. Finding it unlocks a special lure or increases the chance of hooking the legendary tarpon.

## Ambient Life and Animation

Add small environmental details so the location feels alive:

- Pelicans diving for baitfish
- Mullet jumping
- Small baitfish schools near the surface
- Crabs moving around pilings
- A dolphin briefly surfacing in the distance
- Manatees appearing very rarely
- Seagulls circling fishing boats
- Shrimp boats slowly crossing the background
- Mangrove leaves moving in the breeze
- Floating seagrass drifting past
- A distant boat wake reaching the player

These should be lightweight background events and should not distract from fishing.

## Sound Design

Suggested ambient audio:

- Gentle waves against wood
- Distant gulls and pelicans
- Light coastal breeze
- Occasional boat engine
- Dock ropes creaking
- Shrimp boat horn in the distance
- Mullet splashing
- Mangrove insects and birds
- Soft water movement around the boat

The legendary tarpon encounter should have a unique strike sound and a more dramatic music layer.

## Possible Location Challenges

- Catch three speckled seatrout without losing one
- Catch a sheepshead near the dock pilings
- Land a redfish above a target weight
- Catch a flounder using bottom bait
- Catch a snook after sunset
- Catch all five regular Cortez species
- Find the lost tackle box
- Land the Silver King

## Art Direction

All fish should match the established Halley’s Big Catch fish style:

- Bold dark outlines
- Rounded cartoon proportions
- Large expressive eyes
- Bright, saturated colors
- Clean highlights and shading
- Friendly or humorous expressions
- Recognizable anatomical features
- Transparent background for individual fish assets
- Side-facing pose suitable for catch screens
- Consistent visual scale and line thickness

The fish should look playful, but each species must remain immediately identifiable.

## Recommended Progression

Cortez Backwaters should unlock after the player has learned the basic fishing mechanics. It should introduce more structure-based fishing and more varied fish behavior.

**Suggested progression:**

1. Speckled seatrout introduces faster movement.
2. Flounder introduces bottom-oriented resistance.
3. Sheepshead introduces danger from dock structure.
4. Redfish introduces long powerful runs.
5. Snook combines speed, structure, and jumping.
6. Tarpon serves as the final mastery challenge.

## Final Goal

Cortez Backwaters should feel like a loving tribute to fishing around Cortez, Florida. It should be visually warm, full of character, and grounded in the species and scenery anglers would expect from the area.

The location should give players the feeling of fishing old Florida waters from a small boat near mangroves, docks, grass flats, and working fishing vessels—with the possibility that the legendary Silver King could strike at any moment.
