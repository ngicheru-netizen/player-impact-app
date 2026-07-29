//Stat ceilings for each position

const maxValues = {
  Attacker: { goals: 20, assists: 10, dribbles_succ: 90 },
  Midfielder: { goals: 10, assists: 9, key_passes: 80, passes_total: 2400 },
  Defender: { tackles: 110, interceptions: 60, passes_total: 2600 },
};

//stat weights to show how much each stat matters depending on position
// for each position, total should sum to 1.0
const statWeight = {
  Attacker: { goals: 0.6, assists: 0.25, dribbles_succ: 0.15 },
  Midfielder: {
    goals: 0.25,
    assists: 0.25,
    key_passes: 0.3,
    passes_total: 0.2,
  },
  Defender: { tackles: 0.4, interceptions: 0.4, passes_total: 0.2 },
};

const statLabels = {
  goals: "Goals",
  assists: "Assists",
  dribbles_succ: "Successful Dribbles",
  key_passes: "Key Passes",
  passes_total: "Total Passes",
  tackles: "Tackles",
  interceptions: "Interceptions",
};

//make a API variable to dynamically serve page depending on if it's local or on web server
const isLocal =
  window.location.protocol === "file:" || window.location.port === "5500"; //opened on location or opened on LiveServer
const API_BASE = isLocal ? "http://localhost:8000" : "";

//-------------//

//extract player stats
// use ?? to guard against NaN values
function extractPlayerStats(stats) {
  const goals = stats.goals.total ?? 0;
  const assists = stats.goals.assists ?? 0;
  const dribbles_succ = stats.dribbles.success ?? 0;
  const key_passes = stats.passes.key ?? 0;
  const passes_total = stats.passes.total ?? 0;
  const tackles = stats.tackles.total ?? 0;
  const interceptions = stats.tackles.interceptions ?? 0;

  return {
    goals,
    assists,
    dribbles_succ,
    key_passes,
    passes_total,
    tackles,
    interceptions,
  };
}

//show results on page
function displayPlayer(player, stats, containerID) {
  const container = document.getElementById(containerID);
  //Data from API

  const position = stats.games.position;
  const team = stats.team;
  const goals = stats.goals.total;
  const assists = stats.goals.assists;
  const totalTackles = stats.tackles.total;
  const passes = stats.passes.total;
  const attemptedDribbles = stats.dribbles.attempts;
  const successfulDribbles = stats.dribbles.success;
  const interceptions = stats.tackles.interceptions;

  container.innerHTML = `
      <h2>${player.firstname} ${player.lastname}</h2>
      <p>Position: ${stats.games.position}</p>
      <p>Team: ${stats.team.name}</p>
      <p>Goals: ${goals}</p>
      <p>Tackles: ${totalTackles}</p>
      <p>Passes: ${passes}</p>
      <p>Dribbles: ${successfulDribbles}/${attemptedDribbles}</p>
      <p>Interceptions: ${interceptions}</p>`;

  //impact results
  const result = calculateImpactScore(position, stats);
  if (result) {
    let parts = "";
    for (const stat in result.breakdown) {
      const score = result.breakdown[stat];
      const label = statLabels[stat] ?? stat; //show labels correctly on page and protects if label is missing
      parts += `<p>${statLabels[stat]}: ${score}%</p>`;
    }

    //show impact progress bar
    let color;

    if (result.impact >= 70) {
      color = "green";
    } else if (result.impact >= 40) {
      color = "orange";
    } else {
      color = "red";
    }
    //show impact results on page
    container.innerHTML += `
        <hr>
        <p><strong>Impact Score: ${result.impact}/100</strong></p>
        <div class="div-track">
            <div class="div-fill" style="width: ${result.impact}%; background-color: ${color};"></div>
        </div>
        ${parts}`;
  }
  container.style.display = "block";
}

document.addEventListener("DOMContentLoaded", function () {
  const playerName = document.getElementById("playerName");
  const league = document.getElementById("league");
  const season = document.getElementById("season");
  const searchBtn = document.getElementById("mainSearchBtn");
  const form = document.getElementById("playerSearchForm");
  const resultsContainer = document.getElementById("resultsContainer");

  const comparisonPlayerName = document.getElementById("comparisonPlayerName");
  const comparisonLeague = document.getElementById("comparisonLeague");
  const comparisonSeason = document.getElementById("comparisonSeason");
  const compareCheckbox = document.getElementById("compareCheckbox");
  const comparisonSearchBtn = document.getElementById("compareSearchBtn");
  const comparisonSection = document.getElementById("comparisonSection");
  const comparisonForm = document.getElementById("comparisonPlayerSearchForm");
  const comparisonResultsContainer = document.getElementById(
    "comparisonResultsContainer",
  );
  // Find player and show stats
  searchBtn.addEventListener("click", async function handleSearch(e) {
    const playerValue = playerName.value;
    const leagueValue = league.value;
    const seasonValue = season.value;
    e.preventDefault();

    // Call the function to fetch and display player stats
    // console.log(playerValue, leagueValue, seasonValue);

    try {
      const response = await fetch(
        `${API_BASE}/search?player=${playerValue}&league=${leagueValue}&season=${seasonValue}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status ${response.status}`);
      }
      const data = await response.json();
      console.log(data);

      //extract main data
      if (!data.response || data.response.length === 0) {
        resultsContainer.innerHTML =
          "<p>No player found - you might want to check spelling and also make sure that you're choosing the right league";
        return;
      }
      const player = data.response[0].player;
      const stats = data.response[0].statistics[0];
      // show results
      displayPlayer(player, stats, "resultsContainer");
    } catch (error) {
      console.error(`Fetch failed: `, error);
      resultsContainer.innerHTML = "<p>Error getting player data</p>";
    }
  });
  //---------------------------------//

  // show comparison form once "compare" checkbox is checked
  compareCheckbox.addEventListener("change", function () {
    if (compareCheckbox.checked) {
      comparisonSection.style.display = "block";
      //show comparison results
    } else {
      comparisonSection.style.display = "none";
    }
  });

  comparisonSearchBtn.addEventListener(
    "click",
    async function handleCompareSearch(e) {
      const playerValue = comparisonPlayerName.value;
      const leagueValue = comparisonLeague.value;
      const seasonValue = comparisonSeason.value;
      e.preventDefault();

      // Call the function to fetch and display player 2 stats
      // console.log(playerValue, leagueValue, seasonValue);
      try {
        const response = await fetch(
          `${API_BASE}/search?player=${playerValue}&league=${leagueValue}&season=${seasonValue}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status ${response.status}`);
        }
        const data = await response.json();
        console.log(data);

        //extract main data
        const comparisonPlayer = data.response[0].player;
        const comparisonStats = data.response[0].statistics[0];
        // show results
        displayPlayer(
          comparisonPlayer,
          comparisonStats,
          "comparisonResultsContainer",
        );
      } catch (error) {
        console.error(`Fetch failed: `, error);

        comparisonResultsContainer.innerHTML =
          "<p>Error getting player data - try searching by last name</p>";
      }
    },
  );
});

//calculate impact score based on stats and position weighting

function calculateImpactScore(position, stats) {
  const ceilings = maxValues[position];
  const weights = statWeight[position];

  if (!ceilings) return null;

  const values = extractPlayerStats(stats);
  const breakdown = {};
  let impact = 0;

  for (const stat in ceilings) {
    //ratio of stat to ceiling but capped at 1 so as not to to have crazy numbers.
    const score = Math.min(values[stat] / ceilings[stat], 1) * 100; //make it %
    breakdown[stat] = Math.round(score); //what actually shows
    impact = impact + score * weights[stat];
  }
  return { impact: Math.round(impact), breakdown };
}
