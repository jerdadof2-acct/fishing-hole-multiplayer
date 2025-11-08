# Bonus Locations Design - Future Feature

## Overview
Bonus locations are special fishing spots that require **both money AND experience** to unlock, rather than just reaching a certain level. These provide additional end-game content and progression goals.

## Design Specification

### Location Properties

Each location can have the following unlock types:

1. **Level-based** (current system): Unlocks automatically when player reaches required level
   ```javascript
   {
       name: 'Deep Lake',
       unlockType: 'level', // or omit for default
       unlockLevel: 3,
       cost: 50 // Optional entry fee (paid when visiting)
   }
   ```

2. **Purchase-based** (future): Unlocked by spending money
   ```javascript
   {
       name: 'Premium Spot',
       unlockType: 'purchase',
       unlockCost: 1000, // Money required to unlock
       cost: 0 // No entry fee after purchase
   }
   ```

3. **Bonus** (future - NEW): Requires both money AND experience
   ```javascript
   {
       name: 'Elite Fishing Grounds',
       unlockType: 'bonus',
       unlockCost: 5000, // Money required
       unlockExperience: 5000, // Experience points required (deducted on unlock)
       cost: 0, // No entry fee after unlock
       unlockLevel: 10 // Optional minimum level requirement
   }
   ```

### Implementation Details

#### Location Schema Extension
```javascript
{
    name: string,
    difficulty: string,
    fish: number[], // Fish type IDs
    cost: number, // Entry fee per visit (if any)
    
    // Unlock requirements (flexible system)
    unlockType: 'level' | 'purchase' | 'bonus', // Default: 'level'
    
    // Level-based unlock (existing)
    unlockLevel?: number,
    
    // Purchase-based unlock
    unlockCost?: number, // Money to unlock
    
    // Bonus unlock (requires both)
    unlockExperience?: number, // XP to unlock (deducted on purchase)
    
    // Water/Platform (existing)
    waterBodyType: string,
    platformType: string,
    description: string
}
```

#### Player Unlock System Updates

**Current**: `locationUnlocks` is an array of location indices
**Extended**: Track unlock status separately, allow manual unlock for bonus locations

```javascript
// Player class additions
this.locationUnlocks = [0, 1]; // Auto-unlocked locations (indices)
this.bonusLocationUnlocks = {}; // {locationIndex: true} for purchased/bonus locations
```

#### Unlock Methods

1. **Auto-unlock** (level-based): Current system continues to work
   - Unlocks automatically on level up
   - Added to `locationUnlocks` array

2. **Manual unlock** (purchase/bonus): New method
   ```javascript
   player.unlockBonusLocation(locationIndex, locations) {
       const location = locations.getLocation(locationIndex);
       
       if (location.unlockType === 'purchase') {
           if (this.money >= location.unlockCost) {
               this.spendMoney(location.unlockCost);
               this.bonusLocationUnlocks[locationIndex] = true;
               return { success: true, message: 'Location unlocked!' };
           }
           return { success: false, message: 'Not enough money' };
       }
       
       if (location.unlockType === 'bonus') {
           // Check level requirement (if any)
           if (location.unlockLevel && this.level < location.unlockLevel) {
               return { success: false, message: `Requires level ${location.unlockLevel}` };
           }
           
           // Check money
           if (this.money < location.unlockCost) {
               return { success: false, message: 'Not enough money' };
           }
           
           // Check experience (using cumulative experience)
           const totalExp = this.getTotalExperience(); // Need to calculate from level + current exp
           if (totalExp < location.unlockExperience) {
               return { success: false, message: 'Not enough experience' };
           }
           
           // Deduct costs
           this.spendMoney(location.unlockCost);
           this.experience -= location.unlockExperience; // Deduct from current exp
           if (this.experience < 0) {
               // Handle case where deducting would go negative
               // Could allow it or prevent unlock
               this.experience = 0;
           }
           
           this.bonusLocationUnlocks[locationIndex] = true;
           return { success: true, message: 'Bonus location unlocked!' };
       }
   }
   ```

#### UI Integration

1. **Location Selector**:
   - Show locked bonus locations with requirements
   - Display: "🔒 Requires: $5000 + 5000 XP (Level 10+)"
   - Button: "Unlock" (if requirements met) or "Locked" (if not)

2. **Location Shop/Unlock Screen** (new tab or section):
   - List all bonus/purchase locations
   - Show unlock requirements clearly
   - Allow manual unlock with confirmation

3. **Visual Indicators**:
   - 🟢 Unlocked (auto)
   - 🔵 Unlocked (purchased)
   - 🟡 Unlocked (bonus)
   - 🔴 Locked

#### Example Bonus Locations

```javascript
{
    name: 'Elite Trophy Waters',
    difficulty: 'Expert',
    fish: [25, 26, 27, 28, 29, 30, 31, 32], // Trophy fish only
    unlockType: 'bonus',
    unlockCost: 10000, // $10,000
    unlockExperience: 10000, // 10,000 XP
    unlockLevel: 20, // Minimum level 20
    cost: 0,
    description: 'Premium location for trophy fishing',
    waterBodyType: 'OCEAN',
    platformType: 'LARGE_BOAT'
},
{
    name: 'Crystal Cave Pool',
    difficulty: 'Hard',
    fish: [15, 16, 17, 18, 19], // Epic/Legendary fish
    unlockType: 'bonus',
    unlockCost: 5000, // $5,000
    unlockExperience: 5000, // 5,000 XP
    unlockLevel: 15,
    cost: 0,
    description: 'Magical underground fishing spot',
    waterBodyType: 'POND',
    platformType: 'DOCK'
},
{
    name: 'Ancient Fishing Grounds',
    difficulty: 'Expert',
    fish: [20, 21, 22, 23, 24], // Legendary fish
    unlockType: 'bonus',
    unlockCost: 25000, // $25,000
    unlockExperience: 25000, // 25,000 XP
    unlockLevel: 30,
    cost: 0,
    description: 'Where ancient legends were caught',
    waterBodyType: 'LAKE',
    platformType: 'SMALL_BOAT'
}
```

## Implementation Plan

### Phase 1: Data Structure
- [ ] Extend location schema to support `unlockType`
- [ ] Add `bonusLocationUnlocks` to Player class
- [ ] Update location definitions with unlock types

### Phase 2: Unlock Logic
- [ ] Create `unlockBonusLocation()` method in Player class
- [ ] Update `checkUnlocks()` to skip bonus locations
- [ ] Add helper: `getTotalExperience()` to calculate cumulative XP
- [ ] Handle experience deduction (prevent negative)

### Phase 3: UI
- [ ] Update location selector to show unlock requirements
- [ ] Create unlock button/UI for bonus locations
- [ ] Add location unlock confirmation dialog
- [ ] Show visual indicators for unlock status

### Phase 4: Testing
- [ ] Test unlock with sufficient resources
- [ ] Test unlock with insufficient resources
- [ ] Test experience deduction edge cases
- [ ] Test save/load with bonus locations

## Notes

- **Experience Tracking**: May need to track total lifetime experience separately, or calculate from level + current exp
- **Balance**: Bonus locations should be rewarding but not overpowered
- **Progression**: Should feel like meaningful end-game goals
- **UI/UX**: Make unlock requirements clear and unlocking feel rewarding







