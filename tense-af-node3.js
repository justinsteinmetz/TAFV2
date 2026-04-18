// ═══════════════════════════════════════════════════════════════
// TENSE AF — NODE 3 CONTENT (final)
// Past Simple (LAND) vs Present Perfect (RIDE)
//
// Tuning fork: would Boots Riley, Coates, Kaba, Mehdi Hasan,
// Briahna Joy Gray, Kat Abughazaleh, Hannah Ferguson,
// or a literate teenager read this and not wince?
// 
// Principles:
//   - Named agents. No "the system" without specifying which.
//   - Material specificity. Numbers, places, dates, named works.
//   - Humour as mechanism (deadpan, recognition, absurdist precision,
//     self-aware irony). Never as tone.
//   - Self-implication. The writer is in the building too.
//   - Global scope. US is present but not centred.
//   - Personal/breath items provide variety, not filler.
// ═══════════════════════════════════════════════════════════════

const NODE_3_ITEMS = [
  // ─── ENTRY: breath, personal, low friction ───
  {
    id: 'n3-001',
    context: "You're arguing about it with a friend.",
    prompt: "I ___ that film. Don't ask me to explain it.",
    verbPast: "saw",
    verbPerfect: "have seen",
    reveals: {
      land: "Last night. Once through. That was enough.",
      ride: "Three times. And I still can't give you a clean answer."
    }
  },
  {
    id: 'n3-002',
    context: "She travels the way only some passports allow.",
    prompt: "She ___ to Lagos.",
    verbPast: "went",
    verbPerfect: "has been",
    reveals: {
      land: "Once, in 2017. She still talks about the drive from the airport.",
      ride: "Three times now. She came back with a different argument each visit."
    }
  },
  {
    id: 'n3-003',
    context: "There's a new place down the road.",
    prompt: "We ___ that restaurant.",
    verbPast: "tried",
    verbPerfect: "have tried",
    reveals: {
      land: "Once, years ago. The service was the performance.",
      ride: "Enough times to know what to order and what to avoid."
    }
  },

  // ─── STABILITY: hybrid — personal with an edge ───
  {
    id: 'n3-004',
    context: "I'm not in the mood to hear about it again.",
    prompt: "I ___ that conversation. I'm not explaining it again.",
    verbPast: "had",
    verbPerfect: "have had",
    reveals: {
      land: "Last week. With my father. Neither of us said the important part.",
      ride: "More times than I can count. The script doesn't get easier."
    }
  },
  {
    id: 'n3-005',
    // UK · Windrush. Deadpan. "Apology is part of the architecture."
    context: "The government apologises every few years. The deportations don't pause.",
    prompt: "The Home Office ___ Commonwealth citizens as illegal.",
    verbPast: "classified",
    verbPerfect: "has classified",
    reveals: {
      land: "Between 2012 and 2018. They called the paperwork an error.",
      ride: "For over a decade. Apology is now part of the architecture."
    }
  },
  {
    id: 'n3-006',
    // Shell · Niger Delta. Absurdist precision — "sold the wells."
    context: "The report is four hundred pages. The findings fit on one.",
    prompt: "Shell ___ the Niger Delta.",
    verbPast: "poisoned",
    verbPerfect: "has poisoned",
    reveals: {
      land: "For sixty years, as a matter of disclosed policy. Then they sold the wells.",
      ride: "Since before most shareholders were born. Quarterly reports still rise."
    }
  },

  // ─── PRESSURE: structural, specific, named ───
  {
    id: 'n3-007',
    // Baldwin · "The Price of the Ticket" (1985). Specific claim as load-bearing.
    context: "The essays still circulate. The country still doesn't answer.",
    prompt: "Baldwin ___ the price of the ticket.",
    verbPast: "named",
    verbPerfect: "has named",
    reveals: {
      land: "In 1985, in one essay. Whiteness is a lie, built on labour stolen from Black people.",
      ride: "For forty years. Every rediscovery is announced as though it's new."
    }
  },
  {
    id: 'n3-008',
    // Fortress Europe · Mediterranean. The joke is the precision.
    context: "The name changes. The infrastructure stays.",
    prompt: "Fortress Europe ___ thousands in the Mediterranean.",
    verbPast: "drowned",
    verbPerfect: "has drowned",
    reveals: {
      land: "In 2015 alone, more than three thousand. Then the cameras moved. The boats didn't.",
      ride: "Every summer since 2013. It's no longer considered news."
    }
  },
  {
    id: 'n3-009',
    // Stewart Lee / Acaster meta register. The prompt names itself.
    context: "The supply chain runs through mines you'll never see.",
    prompt: "I ___ this on a device assembled by someone younger than you.",
    verbPast: "typed",
    verbPerfect: "have typed",
    reveals: {
      land: "In three minutes. On cobalt from Kolwezi. I didn't pause to notice.",
      ride: "On seven phones across seven years. I still call each one mine."
    }
  },

  // ─── PRESSURE (continued) — specific, named claims ───
  {
    id: 'n3-010',
    // Nina · the four words.
    context: "People still use the word like it's decoration.",
    prompt: "Nina ___ freedom as 'no fear.'",
    verbPast: "defined",
    verbPerfect: "has defined",
    reveals: {
      land: "In one interview in 1968. Four words. Nobody improved on them.",
      ride: "For every generation that's had to learn them again from scratch."
    }
  },
  {
    id: 'n3-011',
    // ICE · same neighbourhoods. The vans update. The addresses don't.
    context: "Three administrations campaign on reforming it. None do.",
    prompt: "ICE ___ the same neighbourhoods.",
    verbPast: "raided",
    verbPerfect: "has raided",
    reveals: {
      land: "Between 2017 and 2021, under the name Priority Enforcement.",
      ride: "Through four administrations. The vans update. The addresses don't."
    }
  },
  {
    id: 'n3-012',
    // Iranian Lego diss tracks 2026. Explosive Media. Kendrick as benchmark,
    // not subject. "One Vengeance For All" is the actual caption. 
    context: "The timeline runs on diss tracks as foreign policy.",
    prompt: "Iranian Lego videos ___ Trump the way Dot ethered Drake.",
    verbPast: "roasted",
    verbPerfect: "have roasted",
    reveals: {
      land: "In one week of 2026. 'One vengeance for all.' Then YouTube banned the channel.",
      ride: "Across every platform the US still pretends to regulate. The memes outlasted the ceasefire."
    }
  },

  // ─── RELEASE: breath + one final mirror ───
  {
    id: 'n3-013',
    context: "It still plays at weddings. She avoids them.",
    prompt: "She ___ that song.",
    verbPast: "heard",
    verbPerfect: "has heard",
    reveals: {
      land: "At a wedding in 2004. Never again. Which is its own mercy.",
      ride: "Enough times that it plays in her head without the radio."
    }
  },
  {
    id: 'n3-014',
    context: "It comes up every time I'm honest about it.",
    prompt: "I ___ that mistake. I'm not pretending I didn't.",
    verbPast: "made",
    verbPerfect: "have made",
    reveals: {
      land: "Once. Decisively. In front of witnesses.",
      ride: "More than once. I'm working on it."
    }
  },
  {
    id: 'n3-015',
    // Mirror. The school, the fees, the silence. You're in the building too.
    context: "People at the school wear it as neutrality.",
    prompt: "We ___ this decision. We're not walking it back.",
    verbPast: "made",
    verbPerfect: "have made",
    reveals: {
      land: "At the meeting last Tuesday. We decided our fees paid for the quiet.",
      ride: "Every year since the school opened. Privilege is a maintained infrastructure."
    }
  }
];

// Expose
if (typeof window !== 'undefined') {
  window.NODE_3_ITEMS = NODE_3_ITEMS;
}
