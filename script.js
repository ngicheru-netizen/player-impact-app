"use strict";
//Stat ceilings for each position

const negativeStats = ["goals_conceded"]; //where a "lower" number is better

const maxValues = {
  Attacker: { goals: 20, assists: 10, dribbles_succ: 90 },
  Midfielder: { goals: 10, assists: 9, key_passes: 80, passes_total: 2400 },
  Defender: { tackles: 110, interceptions: 60, passes_total: 2600 },
  Goalkeeper: { saves: 90, goals_conceded: 75, passes_total: 900 },
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
  Goalkeeper: { saves: 0.5, goals_conceded: 0.35, passes_total: 0.15 },
};

const statLabels = {
  goals: "Goals",
  assists: "Assists",
  dribbles_succ: "Successful Dribbles",
  key_passes: "Key Passes",
  passes_total: "Total Passes",
  tackles: "Tackles",
  interceptions: "Interceptions",
  saves: "Saves",
  goals_conceded: "Goals Conceded",
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
  const saves = stats.goals.saves ?? 0;
  const goals_conceded = stats.goals.conceded ?? 0;

  return {
    goals,
    assists,
    dribbles_succ,
    key_passes,
    passes_total,
    tackles,
    interceptions,
    saves,
    goals_conceded,
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

  //handle for goalkeepers
  let statLines;
  if (position === "Goalkeeper") {
    statLines = `
        <p>Saves: ${stats.goals.saves ?? 0}</p>
        <p>Goals Conceded: ${stats.goals.conceded ?? 0}</p>
        <p>Passes: ${passes}</p>`;
  } else {
    statLines = `<p>Goals: ${goals}</p>
      <p>Tackles: ${totalTackles}</p>
      <p>Passes: ${passes}</p>
      <p>Dribbles: ${successfulDribbles}/${attemptedDribbles}</p>
      <p>Interceptions: ${interceptions}</p>`;
  }

  container.innerHTML = `
    <div class="player-header">
        <img class="player-photo" src="${player.photo}" alt="${player.firstname} ${player.lastname}" onerror="this.remove()">
    
        <div>
            <h2>${player.firstname} ${player.lastname}</h2>
            <p>Position: ${stats.games.position}</p>
            <p>Team: ${stats.team.name}</p>
        </div>
    </div>
      ${statLines}`;

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
        <p class="breakdown-label">How each stat makes up the score:</p>
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
  const statusMessage = document.getElementById("statusMessage");

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
  const limitCounter = document.getElementById("limitCounter");

  //API limit counter helper
  function updateLimitCounter(data) {
    if (!data.rateLimit) return;
    const rl = data.rateLimit;
    limitCounter.textContent = `API: ${rl.dailyRemaining}/${rl.dailyLimit} left today | ${rl.minuteRemaining}/${rl.minuteLimit} left this minute`;
  }

  // Find player and show stats
  searchBtn.addEventListener("click", async function handleSearch(e) {
    e.preventDefault();
    const playerValue = playerName.value;
    const leagueValue = league.value;
    const seasonValue = season.value;

    //make sure min 3 characters are entered in search
    //API auto-refuses to handle search if minimum characters aren't entered

    if (playerValue.trim().length < 3) {
      statusMessage.textContent = "Please enter at least 3 letters to search.";
      return;
    }

    statusMessage.textContent = "Searching..."; //"loading" status ON
    resultsContainer.innerHTML = ""; //clears any results card

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
      updateLimitCounter(data);
      if (data.errors && Object.keys(data.errors).length > 0) {
        resultsContainer.innerHTML =
          "<p>API limit reached - try again later. </p>";
        return;
      }
      console.log(data);

      // show results
      //extract main data
      if (!data.response || data.response.length === 0) {
        resultsContainer.innerHTML =
          "<p>No player found - you might want to check spelling and also make sure that you're choosing the right league";
        return;
      }

      statusMessage.textContent = "";

      const show = (i) =>
        displayPlayer(
          data.response[i].player,
          data.response[i].statistics[0],
          "resultsContainer",
        );

      if (data.response.length === 1) {
        show(0);
      } else {
        displayPlayerPicker(data.response, "resultsContainer", show);
      }
    } catch (error) {
      console.error(`Fetch failed: `, error);

      statusMessage.textContent =
        "Something went wrong while fetching player data. Try again. ";
    }
  });
  //---------------------------------//

  // show comparison form once "compare" checkbox is checked
  //Reshape cards when compare checkbox is ticked
  compareCheckbox.addEventListener("change", function () {
    const main = document.querySelector("main");
    if (compareCheckbox.checked) {
      comparisonSection.style.display = "block";
      comparisonResultsContainer.style.display = "block";
      comparisonResultsContainer.innerHTML =
        "<p>Search a player to compare.</p>";
      main.classList.add("comparing");
    } else {
      comparisonSection.style.display = "none";
      comparisonResultsContainer.style.display = "none";
      main.classList.remove("comparing"); //"compare mode" stays off
    }
  });

  comparisonSearchBtn.addEventListener(
    "click",
    async function handleCompareSearch(e) {
      e.preventDefault();
      const playerValue = comparisonPlayerName.value;
      const leagueValue = comparisonLeague.value;
      const seasonValue = comparisonSeason.value;

      //make sure at least 3 letters are entered to search
      //API auto-refuses to handle search if minimum characters aren't entered
      if (playerValue.trim().length < 3) {
        statusMessage.textContent =
          "Please enter at least 3 letters to search.";
        return;
      }

      statusMessage.textContent = "Searching..."; //"loading" status ON
      comparisonResultsContainer.innerHTML = ""; // clears any results card

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
        updateLimitCounter(data);
        if (data.errors && Object.keys(data.errors).length > 0) {
          resultsContainer.innerHTML =
            "<p>API limit reached - try again later. </p>";
          return;
        }

        console.log(data);

        //extract main data
        if (!data.response || data.response.length === 0) {
          comparisonResultsContainer.innerHTML =
            "<p>No player found - you might want to check spelling and also make sure that you're choosing the right league";
          return;
        }
        statusMessage.textContent = "";

        const show = (i) =>
          displayPlayer(
            data.response[i].player,
            data.response[i].statistics[0],
            "comparisonResultsContainer",
          );

        if (data.response.length === 1) {
          show(0);
        } else {
          displayPlayerPicker(
            data.response,
            "comparisonResultsContainer",
            show,
          );
        }
      } catch (error) {
        console.error(`Fetch failed: `, error);
        statusMessage.textContent =
          "Something went wrong while fetching player data. Try again. ";
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
    const ratio = Math.min(values[stat] / ceilings[stat], 1);
    const adjusted = negativeStats.includes(stat) ? 1 - ratio : ratio; //goals_conceded - ratio (few conceded=better score)
    const score = adjusted * 100; //make it %

    breakdown[stat] = Math.round(score); //what actually shows
    impact = impact + score * weights[stat];
  }
  return { impact: Math.round(impact), breakdown };
}

//if a search returns multiple players (i.e. players with similar lastnames)
//function that allows user to choose desired player

function displayPlayerPicker(results, containerID, onPick) {
  const container = document.getElementById(containerID);
  container.innerHTML = `<p class="picker-label"> ${results.length} players found - pick one:</p>`;

  for (let i = 0; i < results.length; i++) {
    const player = results[i].player;
    const stats = results[i].statistics[0];

    //team Name
    let teamName = "-";
    if (stats && stats.team && stats.team.name) {
      teamName = stats.team.name;
    }

    //player position

    let position = "-";
    if (stats && stats.games && stats.games.position) {
      position = stats.games.position;
    }

    //a button for each player
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-item";
    button.innerHTML =
      "<img src='" +
      player.photo +
      "' alt='' onerror='this.remove()'>" +
      "<span>" +
      player.firstname +
      " " +
      player.lastname +
      "</span>" +
      "<small>" +
      teamName +
      " : " +
      position +
      "</small>";

    //associate button with player

    const chosenIndex = i; //chosen player
    button.addEventListener("click", function () {
      onPick(chosenIndex);
    });
    container.appendChild(button);
  }
  container.style.display = "block";
}
