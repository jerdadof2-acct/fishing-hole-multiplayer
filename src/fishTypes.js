/**
 * Fish Type System
 * Defines all 33 fish types with their properties and facts
 */

export const FishTypes = [
    // Common (0-4)
    { id: 0, name: 'Minnow', rarity: 'Common', minWeight: 0.1, maxWeight: 0.5, value: 5, experience: 1, season: 'All' },
    { id: 1, name: 'Sunfish', rarity: 'Common', minWeight: 0.3, maxWeight: 1.2, value: 8, experience: 2, season: 'All' },
    { id: 2, name: 'Bass', rarity: 'Common', minWeight: 1.0, maxWeight: 5.0, value: 15, experience: 5, season: 'All' },
    { id: 3, name: 'Perch', rarity: 'Common', minWeight: 0.5, maxWeight: 2.0, value: 12, experience: 3, season: 'All' },
    { id: 4, name: 'Crappie', rarity: 'Common', minWeight: 0.8, maxWeight: 3.0, value: 18, experience: 4, season: 'All' },
    
    // Uncommon (5-9)
    { id: 5, name: 'Trout', rarity: 'Uncommon', minWeight: 0.5, maxWeight: 3.0, value: 25, experience: 10, season: 'Spring/Fall' },
    { id: 6, name: 'Pike', rarity: 'Uncommon', minWeight: 2.0, maxWeight: 8.0, value: 40, experience: 15, season: 'All' },
    { id: 7, name: 'Walleye', rarity: 'Uncommon', minWeight: 1.5, maxWeight: 6.0, value: 35, experience: 12, season: 'Spring/Fall' },
    { id: 8, name: 'Muskie', rarity: 'Uncommon', minWeight: 5.0, maxWeight: 15.0, value: 60, experience: 20, season: 'All' },
    { id: 9, name: 'Carp', rarity: 'Uncommon', minWeight: 3.0, maxWeight: 20.0, value: 30, experience: 8, season: 'All' },
    
    // Rare (10-14)
    { id: 10, name: 'Salmon', rarity: 'Rare', minWeight: 8.0, maxWeight: 25.0, value: 80, experience: 25, season: 'Fall' },
    { id: 11, name: 'Catfish', rarity: 'Rare', minWeight: 5.0, maxWeight: 30.0, value: 70, experience: 22, season: 'All' },
    { id: 12, name: 'Sturgeon', rarity: 'Rare', minWeight: 20.0, maxWeight: 50.0, value: 120, experience: 35, season: 'All' },
    { id: 13, name: 'Marlin', rarity: 'Rare', minWeight: 50.0, maxWeight: 200.0, value: 200, experience: 50, season: 'All' },
    { id: 14, name: 'Tuna', rarity: 'Rare', minWeight: 30.0, maxWeight: 150.0, value: 150, experience: 40, season: 'All' },
    
    // Epic (15-19)
    { id: 15, name: 'Crystal Bass', rarity: 'Epic', minWeight: 10.0, maxWeight: 35.0, value: 300, experience: 60, season: 'All' },
    { id: 16, name: 'Golden Trout', rarity: 'Epic', minWeight: 5.0, maxWeight: 20.0, value: 250, experience: 55, season: 'Spring' },
    { id: 17, name: 'Ice Pike', rarity: 'Epic', minWeight: 15.0, maxWeight: 40.0, value: 350, experience: 65, season: 'Winter' },
    { id: 18, name: 'Shadow Catfish', rarity: 'Epic', minWeight: 25.0, maxWeight: 60.0, value: 400, experience: 70, season: 'All' },
    { id: 19, name: 'Abyssal Eel', rarity: 'Epic', minWeight: 30.0, maxWeight: 80.0, value: 500, experience: 80, season: 'All' },
    
    // Legendary (20-24)
    { id: 20, name: 'Ancient Sturgeon', rarity: 'Legendary', minWeight: 100.0, maxWeight: 300.0, value: 1000, experience: 150, season: 'All' },
    { id: 21, name: 'Leviathan', rarity: 'Legendary', minWeight: 200.0, maxWeight: 500.0, value: 2000, experience: 200, season: 'All' },
    { id: 22, name: 'Phoenix Fish', rarity: 'Legendary', minWeight: 50.0, maxWeight: 150.0, value: 1500, experience: 180, season: 'All' },
    { id: 23, name: 'Dragon Carp', rarity: 'Legendary', minWeight: 80.0, maxWeight: 200.0, value: 1800, experience: 190, season: 'All' },
    { id: 24, name: 'Tournament King', rarity: 'Legendary', minWeight: 60.0, maxWeight: 120.0, value: 1200, experience: 160, season: 'All' },
    
    // Trophy (25-32)
    { id: 25, name: 'Trophy Bass', rarity: 'Trophy', minWeight: 20.0, maxWeight: 50.0, value: 500, experience: 100, season: 'All' },
    { id: 26, name: 'Trophy Pike', rarity: 'Trophy', minWeight: 30.0, maxWeight: 70.0, value: 600, experience: 110, season: 'All' },
    { id: 27, name: 'Trophy Salmon', rarity: 'Trophy', minWeight: 40.0, maxWeight: 80.0, value: 700, experience: 120, season: 'Fall' },
    { id: 28, name: 'Trophy Marlin', rarity: 'Trophy', minWeight: 100.0, maxWeight: 300.0, value: 1000, experience: 150, season: 'All' },
    { id: 29, name: 'Trophy Tuna', rarity: 'Trophy', minWeight: 80.0, maxWeight: 200.0, value: 800, experience: 130, season: 'All' },
    { id: 30, name: 'Trophy Sturgeon', rarity: 'Trophy', minWeight: 150.0, maxWeight: 400.0, value: 1200, experience: 170, season: 'All' },
    { id: 31, name: 'Trophy Catfish', rarity: 'Trophy', minWeight: 60.0, maxWeight: 150.0, value: 900, experience: 140, season: 'All' },
    { id: 32, name: 'Trophy King', rarity: 'Trophy', minWeight: 200.0, maxWeight: 500.0, value: 1500, experience: 200, season: 'All' }
];

// Fish facts database
export const FishFacts = {
    'Minnow': { fact: 'Tiny but mighty! Minnows travel in huge schools of thousands.', fun: 'So small, even cats think they\'re fishnacks!', real: 'They make excellent live bait due to their movement.' },
    'Sunfish': { fact: 'Brightly colored and curious little fish.', fun: 'Named for their sunny disposition, not their speed!', real: 'Belongs to the same family as bass.' },
    'Bass': { fact: 'Aggressive predators with a taste for action.', fun: 'The original bass drops are underwater!', real: 'Can grow up to 25 pounds in ideal conditions.' },
    'Perch': { fact: 'Striped like a prison uniform for fish crimes.', fun: 'Perched on the edge of greatness... and your hook.', real: 'Lives in freshwater lakes and rivers worldwide.' },
    'Crappie': { fact: 'Don\'t let the name fool you - delicious eating!', fun: 'Sounds fishy, tastes great!', real: 'Very popular for sport fishing and pan-frying.' },
    'Trout': { fact: 'Living fossils, some species date back 50 million years.', fun: 'Prefers cold water and colder comedy.', real: 'Can detect vibrations in water from miles away.' },
    'Pike': { fact: 'Razor-sharp teeth and an attitude to match.', fun: 'The needlefish needle... no, the other way around!', real: 'Ambush predators that can strike at 6 mph.' },
    'Walleye': { fact: 'Has eyes that glow at night like a cat in the dark.', fun: 'Sees everything, forgives nothing.', real: 'Named for their reflective eyes that help night fishing.' },
    'Muskie': { fact: 'The freshwater version of a shark.', fun: 'Fish of 10,000 casts... but we only count the caught ones!', real: 'Can live up to 30 years in the wild.' },
    'Carp': { fact: 'Bottom feeders who love muddy waters.', fun: 'King of the murky depths and questionable dietary choices.', real: 'Introduced to North America in the 1800s.' },
    'Salmon': { fact: 'Journeys hundreds of miles to spawn in their birthplace.', fun: 'Swims upstream in life like we do on Mondays.', real: 'Changes color dramatically during spawning season.' },
    'Catfish': { fact: 'Whiskered bottom dwellers with electrical sensors.', fun: 'Has more whiskers than my uncle at Christmas!', real: 'Some species can grow over 100 pounds.' },
    'Sturgeon': { fact: 'Living dinosaurs that can reach 20 feet and 3,000 pounds!', fun: 'Swims like it owns the river... because it probably does.', real: 'Can live over 100 years old.' },
    'Marlin': { fact: 'Speed demon of the ocean, reaching 60+ mph.', fun: 'The sports car of the sea with a bill for a bumper.', real: 'One of the fastest fish in the ocean.' },
    'Tuna': { fact: 'Warm-blooded fish that never stops swimming.', fun: 'If it stops swimming, we all get sushi!', real: 'Can maintain body heat 10°F warmer than water.' },
    'Crystal Bass': { fact: 'Rare variant that shimmers like diamonds.', fun: 'Blindingly beautiful and dangerously expensive!', real: 'Color mutation found in less than 1% of bass.' },
    'Golden Trout': { fact: 'Flashy mountain trout from the Sierra Nevadas.', fun: 'More valuable than gold... well, bronze at least.', real: 'Native to alpine streams above 9,000 feet.' },
    'Ice Pike': { fact: 'Arctic warrior that thrives in frozen waters.', fun: 'Thinks 32°F is a perfect swimming temperature!', real: 'Produces antifreeze proteins in blood.' },
    'Shadow Catfish': { fact: 'Elusive nocturnal hunter of the deep.', fun: 'Wears sunglasses at night... underwater.', real: 'Evolved enhanced senses for dark water hunting.' },
    'Abyssal Eel': { fact: 'Deep sea dweller from the darkest depths.', fun: 'Lives where light fears to tread... literally.', real: 'Can survive under crushing ocean pressure.' },
    'Ancient Sturgeon': { fact: 'Prehistoric fish that outlived dinosaurs.', fun: 'Older than your ancestors and twice as grumpy!', real: 'Lived through the extinction that killed dinosaurs.' },
    'Leviathan': { fact: 'Mythical sea monster of biblical proportions.', fun: 'Size: YES. Attitude: Also YES.', real: 'Inspired by giant prehistoric whales.' },
    'Phoenix Fish': { fact: 'Legendary creature that rises from the depths.', fun: 'Dying means a new fishing trip for it!', real: 'Mythical fish symbolizing rebirth and renewal.' },
    'Dragon Carp': { fact: 'Legend speaks of its fiery underwater presence.', fun: 'Breathes underwater fire... and smoke signals.', real: 'Ancient Asian legends speak of dragon fish.' },
    'Tournament King': { fact: 'Crown jewel of competitive fishing.', fun: 'Wins every beauty contest it enters!', real: 'Prized catch in professional fishing tournaments.' },
    'Trophy Bass': { fact: 'Wall-hanger of epic proportions.', fun: 'Big enough to tell fishing lies about!', real: 'World record: 22 lbs 4 oz.' },
    'Trophy Pike': { fact: 'Predator that makes other fish nervous.', fun: 'Has a resume of 10,000 minor offenses.', real: 'Can grow over 50 inches long.' },
    'Trophy Salmon': { fact: 'Ocean warrior returned to freshwater.', fun: 'Swam an entire marathon just to spawn!', real: 'Can leap 10 feet in waterfalls.' },
    'Trophy Marlin': { fact: 'Trophy that dreams are made of.', fun: 'Bill so long it doubles as a sword!', real: 'Can reach speeds over 68 mph.' },
    'Trophy Tuna': { fact: 'Ocean giant worth its weight in sashimi.', fun: 'Sushi price tag included!', real: 'Can weigh over 1,000 pounds.' },
    'Trophy Sturgeon': { fact: 'Ancient giant of the rivers.', fun: 'Older than your grandpa and twice as wise!', real: 'Some reach over 15 feet long.' },
    'Trophy Catfish': { fact: 'Freshwater giant with suction cup mouth.', fun: 'Named "Trophy" because it won first place!', real: 'World record catfish was over 300 lbs.' },
    'Trophy King': { fact: 'The ultimate catch - king of all fish!', fun: 'Rules the depths with an iron fin!', real: 'Crown jewel of any angler\'s collection.' }
};

/**
 * Get fish type by ID
 * @param {number} id - Fish ID
 * @returns {Object|null} Fish type object or null
 */
export function getFishTypeById(id) {
    return FishTypes.find(fish => fish.id === id) || null;
}

/**
 * Get random fish for location based on fish array
 * @param {Array<number>} fishIds - Array of fish IDs available at location
 * @returns {Object} Fish type with random weight
 */
export function getRandomFishForLocation(fishIds) {
    if (!fishIds || fishIds.length === 0) {
        // Default to common fish if no fish array
        fishIds = [0, 1, 2];
    }
    
    // Select random fish from available fish
    const randomFishId = fishIds[Math.floor(Math.random() * fishIds.length)];
    const fishType = getFishTypeById(randomFishId);
    
    if (!fishType) {
        // Fallback to Bass if fish type not found
        return {
            ...getFishTypeById(2),
            weight: 1.0 + Math.random() * 4.0
        };
    }
    
    // Calculate random weight within range
    const weight = fishType.minWeight + Math.random() * (fishType.maxWeight - fishType.minWeight);
    
    return {
        ...fishType,
        weight: parseFloat(weight.toFixed(2))
    };
}

/**
 * Get fish facts
 * @param {string} fishName - Fish name
 * @returns {Object} Fish facts {fact, fun, real}
 */
export function getFishFacts(fishName) {
    return FishFacts[fishName] || {
        fact: 'A mysterious fish.',
        fun: 'Full of surprises!',
        real: 'Still being studied.'
    };
}

/**
 * Get all fish types
 * @returns {Array} All fish types
 */
export function getAllFishTypes() {
    return FishTypes;
}

/**
 * Get fish image path
 * @param {string} fishName - Fish name
 * @returns {string} Image path
 */
export function getFishImagePath(fishName) {
    // Fish images are in assets/images/ with Title Case names (e.g., "Bass.png", "Ancient Sturgeon.png")
    // Keep the fish name as-is (Title Case with spaces) since that's how the files are named
    return `assets/images/${fishName}.png`;
}

