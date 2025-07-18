const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("svg")
              .attr("width", width)
              .attr("height", height);

let container = svg.append("g");
let playersData, linksData;
let isHighlighted = false;

// Global: highlight a player by ID
function highlightPlayer(selectedId) {
  isHighlighted = true;

  container.selectAll("path.link")
    .transition().duration(300)
    .attr("stroke-width", linkData => {
      return (linkData.source.id === selectedId || linkData.target.id === selectedId) ? 4 : 1;
    })
    .attr("opacity", linkData => {
      return (linkData.source.id === selectedId || linkData.target.id === selectedId) ? 1 : 0.1;
    });

  container.selectAll(".link-label textPath")
    .transition().duration(300)
    .attr("opacity", labelData => {
      return (labelData.source.id === selectedId || labelData.target.id === selectedId) ? 1 : 0.1;
    });

  container.selectAll("circle")
    .transition().duration(300)
    .attr("opacity", nodeData => {
      return (selectedId === nodeData.id || linksData.some(l => (l.source.id === selectedId || l.target.id === selectedId) &&
                                                               (l.source.id === nodeData.id || l.target.id === nodeData.id))) ? 1 : 0.1;
    });

  container.selectAll(".label")
    .transition().duration(300)
    .attr("opacity", nodeData => {
      return (selectedId === nodeData.id || linksData.some(l => (l.source.id === selectedId || l.target.id === selectedId) &&
                                                               (l.source.id === nodeData.id || l.target.id === nodeData.id))) ? 1 : 0.1;
    });
}

// Global: search player by name
function searchPlayer() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const player = playersData.find(p => p.name.toLowerCase() === query);

  if (player) {
    highlightPlayer(player.id);
  } else {
    alert("Player not found!");
  }
}

svg.call(d3.zoom()
    .scaleExtent([0.5, 5])
    .on("zoom", (event) => {
        container.attr("transform", event.transform);
    }));

Promise.all([
  d3.csv("players.csv"),
  d3.csv("relationships.csv")
]).then(([players, rawLinks]) => {

  players.forEach(d => {
    d.id = d.id.toString();
    d.name = d.name;
    d.team = d.team;
  });

  rawLinks.forEach(d => {
    d.source = d.source.toString();
    d.target = d.target.toString();
    d.type = d.type.toLowerCase().trim();
  });

  const priority = ["relationship", "dated", "hooked up", "kissed", "exes", "rumor"];

  const pairMap = new Map();

  rawLinks.forEach(l => {
    const key = [l.source, l.target].sort().join("-");
    const current = pairMap.get(key);
    if (!current || priority.indexOf(l.type) < priority.indexOf(current.type)) {
      pairMap.set(key, l);
    }
  });

  const links = Array.from(pairMap.values());

  links.forEach((d, i) => {
    d.id = "linkPath" + i;
  });

  playersData = players;
  linksData = links;

  const connectionCounts = {};
  players.forEach(d => connectionCounts[d.id] = 0);
  links.forEach(l => {
    connectionCounts[l.source]++;
    connectionCounts[l.target]++;
  });
  
    // Define link styles by type
  const linkStyles = {
    "relationship":   { color: "#78A65A",   dash: "" },
    "exes":     { color: "#EA3323",  dash: "" },
    "dated":     { color: "#A4C1E2",  dash: "" },
    "rumor":    { color: "#A05BF6",  dash: "" },
    "kissed":   { color: "#F2994A",  dash: "4,4" },
    "hooked up":{ color: "#F65BDC",dash: "" },
  };

  // Outline colors/teams
  const teamColors = {
  "BG": "teal",
  "PL": "#FF00B9",
  "LR": "blue"
};

  container.insert("rect", ":first-child")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .style("cursor", "default")
    .on("click", () => {
      if (isHighlighted) {
        isHighlighted = false;

        container.selectAll("path.link")
          .transition().duration(300)
          .attr("stroke-width", 2)
          .attr("opacity", 0.6);

        container.selectAll(".link-label textPath")
          .transition().duration(300)
          .attr("opacity", 1);

        container.selectAll("circle")
          .transition().duration(300)
          .attr("opacity", 1);

        container.selectAll(".label")
          .transition().duration(300)
          .attr("opacity", 1);
      }
    });

  const simulation = d3.forceSimulation(players)
    .force("link", d3.forceLink(links).id(d => d.id).distance(300))
    .force("radial", d3.forceRadial(450, width / 2, height / 2).strength(0.15))
    .force("collide", d3.forceCollide(60))
    .on("tick", ticked);

  const link = container.selectAll("path.link")
    .data(links)
    .enter()
    .append("path")
    .attr("class", d => `link link-${d.source} link-${d.target}`)
    .attr("id", d => d.id)
    .attr("fill", "none")
    .attr("stroke", d => (linkStyles[d.type]?.color) || "white")
    .attr("stroke-dasharray", d => (linkStyles[d.type]?.dash) || "")
    .attr("stroke-width", 2)
    .attr("opacity", 0.6);

  const labelGroup = container.append("g").attr("class", "labels");

  labelGroup.selectAll("text")
    .data(links)
    .enter()
    .append("text")
    .attr("class", "link-label")
    .append("textPath")
    .attr("href", d => `#${d.id}`)
    .attr("startOffset", "50%")
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#aaa")
    .text(d => d.type);

  const node = container.selectAll("circle")
    .data(players)
    .enter()
    .append("circle")
    .attr("r", d => 10 + connectionCounts[d.id] * 3)
    .attr("fill", "#333")
    .attr("stroke", d => teamColors[d.team] || "white")
    .attr("stroke-width", 3)
    .call(d3.drag()
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded)
    )
    .on("mouseover", function(event, d) {
      d3.select(this).transition().duration(300).attr("r", 10 + connectionCounts[d.id] * 3 + 5).attr("fill", "#555");
      container.selectAll(`.link-${d.id}`).transition().duration(300).attr("stroke-width", 4).attr("opacity", 1);
    })
    .on("mouseout", function(event, d) {
      d3.select(this).transition().duration(300).attr("r", 10 + connectionCounts[d.id] * 3).attr("fill", "#333");
      if (!isHighlighted) {
        container.selectAll(`.link-${d.id}`).transition().duration(300).attr("stroke-width", 2).attr("opacity", 0.6);
      }
    })
    .on("click", function(event, d) {
      highlightPlayer(d.id);
    });

  const names = container.selectAll(".label")
    .data(players)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "#fff")
    .text(d => d.name);

  function ticked() {
    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    names
      .attr("x", d => d.x)
      .attr("y", d => d.y + 4);

    link
      .attr("d", d => {
        const sx = d.source.x;
        const sy = d.source.y;
        const tx = d.target.x;
        const ty = d.target.y;
        const dx = tx - sx;
        const dy = ty - sy;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
        return `M${sx},${sy} A${dr},${dr} 0 0,1 ${tx},${ty}`;
      });
  }

  function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
});
