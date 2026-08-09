/**
 * Release notes shown on the main menu.
 *
 * Kept as data rather than markup so the menu can group and style it, and so there is one
 * obvious place to append to when something ships. Player-facing wording only — refactors,
 * build changes and internal invariants belong in CLAUDE.md, not here.
 */
export const RELEASE = Object.freeze({
  version: '0.7.5',
  stage: 'beta',

  changelog: [
    'New UI for Shop',
    'New UI for Inventory and Hand (previously "Pocket")',
    'Card scaling fixed',
    'Added a sound engine — you will hear sound effects and music now!',
    'Updated menu navigation UI',
    'Fixed runes not rising properly in navbar UI',
    'Expedition, Lab, and Market are no longer accessible as I work on these aspects of the gameplay loop.',
    'Added ambience SFX to Foundry and Wilderness',
    'Added 3D backdrops to Foundry and Wilderness',
    'New notification system shows where new loot has been acquired',
    'Players are now allowed to store a maximum of 20 card packs at once',
    'Created a new graphics setting (Low, Med, High).',
    'Added a volume mixer (change music, SFX, ambience, etc all separately).',
    'New UI for the Forge — everything you load is the same size and lined up, and the flow arrow now shows which materials are actually feeding the smelt.',
    'Fixed coal being destroyed when you refresh the game. Coal from older saves is recovered.',
    'Your Hand is now a fan of cards along the bottom of the screen instead of a drawer on the right. Hover a card to see it in full, and drag cards to the bottom of the screen to add them.',
    'The Bag now uses the full height of the screen.',
    'Fixed the audio mixer opening behind the menu bar.',
    'Cards are now the same size everywhere they are held — Foundry, Wilderness and your Hand.',
    'Fixed ingots not being slottable as a secondary smelting ingredient. You no longer have to load the ore first.',
    'Fixed the Foundry resizing itself when you collect.',
    'Your Hand now holds a maximum of 6 cards.',
    'Card placement sounds now play in full instead of being cut off early.',
    'The Bag tab is now a bookmark shape.',
    'The menu bar highlight no longer slides between tabs.',
    'One main menu now, with the mountains and the release notes on it. It no longer enters the game on its own — press Enter when you are ready.',
    'Hand cards sit higher and are much easier to read, and their remove button moved inside the card corner so it is easier to hit.',
    'The Hand is always visible now — no more show/hide button.',
    'Fixed loot in the Collection Queue rendering as tall cards until a second row appeared.',
    'Hovering a card in your Hand raises it half as far as before.',
    'Ores and ingots now always appear in their own Bag sections. Coal no longer jumps to "Gathered" after passing through the Forge, and gathered ingots are filed with smelted ones.',
    'Earning gold now sends a burst of gold up to your total in the corner. Bigger payouts throw a bigger stream, and the number climbs as the gold lands rather than before it.',
    'Treasure pack coins now burst where they sit instead of flying off to your Bag.',
    'New fonts throughout — one family for the wordmark, one for the menus, one for everything else.',
    'Loot notification diamonds now sit on the navbar line and pulse a much larger echo when new loot arrives.',
    'Cards can be dragged out of a work slot straight into your Hand, and pressing x releases them to your Collection instead.',
    'Fixed the card placement rings sometimes drawing over the front of the card.',
    'Wilderness Processing now uses the same layout as the Forge — full-size cards, equal slots, and a flow arrow that shows what is feeding the work.',
  ],

  known: [
    "Some SFX don't play properly or on time",
    'Memory and graphics optimization — will add more in-depth graphics options for players in the future.',
    "Arcana station still doesn't work as intended. Currently a work-in-progress.",
  ],

  planned: [
    'Crafting Station',
    'More card types',
    'Merchant to run the shop + more shop deals and variance.',
    'Additional item sockets for workers in Foundry and Wilderness to enhance card effects and focuses.',
    'Expedition system',
    'Multiplayer Market for card trading.',
  ],
});
