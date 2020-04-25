//Initialize SVG
	let w = 1200;
  	let h = 600;

	let svg = d3.select("#map")
		.append("svg")
		.attr("width", w)
		.attr("height", h)
		.style("background", "#fff");

	let g = svg.append("g");


	//Initialize Color Scale
	let color_scheme = d3.scaleLinear()
	    	.domain([0, 0.25, 0.5, 0.75, 1] )
	    	.range(['#0571b0','#92c5de','#f7f7f7','#f4a582','#ca0020']);

    function color_county(value){
		if (value == undefined)
    		return '#fff'
    	else
    		return color_scheme(value);
    }

    //Initialize Map Scale
    const projection = d3.geoAlbers();

	const  scaleBar = d3.geoScaleBar()
	    .projection(projection)
	    .size([w, h])
		.left(.829)
		.top(0.85)
 		.units(d3.geoScaleMiles)
		.label("Miles") // The label on top of the scale bar
	    .labelAnchor("middle")
	    .tickFormat(d3.format(","));
  
  	svg.append("g")
      .call(scaleBar);


	//Initialize GOP Scale Legend
	svg.append("g")
	  .attr("class", "legendLinear")
	  .attr("transform", "translate(850,550)");

	var legendLinear = d3.legendColor()
	  .shapeWidth(45)
	  .shapeHeight(8)
	  .shapePadding(0.8)
	  .labels(["0",'0.25','0.5','0.75','1'])
	  .labelFormat(d3.format(""))
	  .title('GOP Percentage')
	  .cells(5)
	  .orient('horizontal')
	  .scale(color_scheme);

	svg.select(".legendLinear")
	  .call(legendLinear);

	//Initialize Flows Legend
	var ordinal = d3.scaleOrdinal()
	  .domain(["Inbound Migration", "Outbound Migration"])
	  .range(["#d65200","#36ab91"]);

	svg.append("g")
	  .attr("class", "legendOrdinal")
	  .attr("transform", "translate(850,450)");

	var legendOrdinal = d3.legendColor()
	  .shape("path", d3.symbol().type(d3.symbolSquare).size(150)())
	  .title('Migration Links')
	  .shapePadding(10)
	  .scale(ordinal);

	svg.select(".legendOrdinal")
	  .call(legendOrdinal);

	//Initialize North Arrow
	svg.append("svg:image")
		.attr('x', 1020)
		.attr('y', 420)
		.attr('width', 60)
		.attr('height', 80)
		.attr("xlink:href", "data/northarrow.svg")
	
	//Initialize Tooltip
	var tooltip = d3.select("#maincontainer")
		.append("div")	
		.attr("class", "tooltip")       
		.style("opacity", 0);

    var tooltipLinks = d3.select("#maincontainer")
		.append("div")	
		.attr("class", "tooltip")       
		.style("opacity", 0);

	////////////////////////////////////////////////////////////
	//////////////Utility Functions ///////////////////////////				
	////////////////////////////////////////////////////////////	

	let path = d3.geoPath();  
	let isClicked = false; 
	let lineSize = d3.scaleLog().range([1,10]).domain([19, 37393]);
	let links;
	const linkedByIndex = {};

	function isConnected(a, b) {
	  	return linkedByIndex[`${a},${b}`] || linkedByIndex[`${b},${a}`] || a === b;
	}


	function checkUndefined(value){
  		if (value === undefined){
  			return 0;
  		}
  		else{
  			return parseInt(value);
  		}
	}

	function findConnectedCounty(selectCountId){
  		let resultGoing = links.filter(obj =>{ return obj.fips_ori == selectCountId});
  		let resultComing = links.filter(obj =>{ return obj.fips_des == selectCountId});
  		return [resultGoing,resultComing]
  	}

	function getExemptions(a,b){
		let Inbound = linkedByIndex[`${a},${b}`];
		let Outbound = linkedByIndex[`${b},${a}`]; 
		let exemptions = [checkUndefined(Inbound),checkUndefined(Outbound)];
		return exemptions;
	}

	function countMigrants(migrantArray){
  		let goingMigrants = 0, comingMigrants = 0;
  		migrantArray[0].forEach(function(entry){
  			goingMigrants = goingMigrants + parseInt(entry.exemptions);
  		})
  		migrantArray[1].forEach(function(entry){
  			comingMigrants = comingMigrants + parseInt(entry.exemptions);
  		})

  		return [goingMigrants,comingMigrants]
	}

	function extractId(data){
	  		let connected = [];
	  		data[0].forEach(d => {connected.push(d.fips_des);})
	  		data[1].forEach(d => {connected.push(d.fips_ori);})
	  		return [...new Set(connected)];
	}


	////////////////////////////////////////////////////////////
	//////////////// Main Function /////////////////////////////			
	////////////////////////////////////////////////////////////	



	d3.queue()
	    .defer(d3.json, "https://d3js.org/us-10m.v1.json")
	    .defer(d3.json, "data/county_nodes.json")
	    .defer(d3.json, "data/flows_data.json")
	    .await(createMap);

    function createMap(error, us, nodes, flows){
    	if (error) throw error;


    	// Preparing nodes and links
    	const countiesGeo = us.objects.counties.geometries;
    	links = flows;
    	
    	for (const i in nodes) { // Loop through  data countyid
			for (const j in countiesGeo) { // Loop through countiesGeo
				if (nodes[i].fips === countiesGeo[j].id) { // If ids match
					countiesGeo[j].properties = {};
					for (const k in nodes[i]) {
						if (k !== "countyid") { // No need to add countyid
							countiesGeo[j].properties[k] = nodes[i][k];
						}
					}
					break;
				}
			}
		}

		
	  	flows.forEach(d => {
	    	linkedByIndex[`${d.fips_ori},${d.fips_des}`] = d.exemptions;
	  	});
  		
		
		// Creating Counties
	    let counties =	g.selectAll('path')
	    	.data(topojson.feature(us, us.objects.counties).features)
			.enter().append("path")
			.attr("class", "counties")
			.attr("id", function(d) { return 'county' + d.id; })
			.attr("d", path)
			.attr("fill", d => color_county(d.properties['gop_pct_2016']))
	    	.on('mouseover',fade(0.04,'over',isClicked))
	    	.on('mouseout',fade(1,'out',isClicked))
	    	.attr('stroke','white')
	    	.attr('stroke-width',0.5)
	    	.on('click',clickedCounty)
	    	.on('dblclick',resetViz);

	    function resetViz(){
	    	console.log('hi');
	    }

	    //Function for clcked county
    	function clickedCounty(selected){
    		isClicked = true;
    		let selectedx = path.centroid(selected)[0];
  			let selectedy = path.centroid(selected)[1];

  			let data = findConnectedCounty(selected.id);

  			g.selectAll(".goingline")
			.attr("stroke-dasharray", 0)
			.remove()
  
			g.selectAll(".goingline")
			.data(data[0])
			.enter().append("path")
			.attr("class", "goingline")
			.attr("d", function(d){
				let cId = d.fips_des;
				let theCounty = d3.select("#county" + cId);

				let togetCentroid = theCounty._groups[0][0].__data__;

				let destinationx = path.centroid(togetCentroid)[0];
				let destinationy = path.centroid(togetCentroid)[1];

				let dx = destinationx - selectedx, 
					dy = destinationy - selectedy,
					dr = Math.sqrt(dx * dx + dy * dy);

				return "M" + selectedx + "," + selectedy + "A" + dr + "," + dr +
					" 0 0,1 " + destinationx + "," + destinationy;

			})
			.call(transition)
			.attr('stroke-width',function(d){return lineSize(parseInt(d.exemptions));})
			.attr('stroke','#36ab91')
			.attr("fill", "none")
	  		.attr("opacity", 0.7)
	  		.attr("stroke-linecap", "round")
	  		

	  		//Function for creating links
	  		g.selectAll(".comingline")
			.attr("stroke-dasharray", 0)
			.remove()
  
			g.selectAll(".comingline")
			.data(data[1])
			.enter().append("path")
			.attr("class", "comingline")
			.attr("d", function(d){
				let cId = d.fips_ori;
				let theCounty = d3.select("#county" + cId);
				let togetCentroid = theCounty._groups[0][0].__data__;
				

				let originx = path.centroid(togetCentroid)[0];
				let originy = path.centroid(togetCentroid)[1];


				let dx = selectedx - originx,
					dy = selectedy - originy,
					dr = Math.sqrt(dx * dx + dy * dy);
					    return "M" + originx + "," + originy + "A" + dr + "," + dr +
					" 0 0,1 " + selectedx + "," + selectedy;

			})
			.call(transition)
			.attr('stroke-width',function(d){return lineSize(parseInt(d.exemptions)); })
			.attr('stroke','#d65200')
			.attr("fill", "none")
	  		.attr("opacity", 0.7)
	  		.attr("stroke-linecap", "round")

	  		handleCountyColor(data,selected);

		}

		//county color on clicked
		function handleCountyColor(data,chosen){
			tooltip.remove();
			let connectId = extractId(data);
	  		connectId.push(chosen.id);
	  		counties.style('fill-opacity', function(o){
	  				const connectOpacity = (connectId.includes(o.id)) ? 1 : 0.1;
	    			this.setAttribute('fill-opacity', connectOpacity);
	     			return connectOpacity;
	    	}) 
	    	counties.on('mouseover',function(o){
	    		if(connectId.includes(o.id)){
	    			tooltipLinks.transition()    
		            		.duration(200)    
		            		.style("opacity", 1); 
		     
		            		var mouse = d3.mouse(d3.select('.counties').node()); 
		            		if(chosen.id === o.id){
		            			var Migrants = findConnectedCounty(o.id);
		            			var cMigrants = countMigrants(Migrants);
			            		var goppct = parseFloat(o.properties.gop_pct_2016).toFixed(2);
			            	tooltipLinks.html("<font size=3>" + "<b>" + o.properties.namelsad + "</b>" + "</font>" + "<br/>" + o.properties.state + "<br/>" + "<br/>" + " GOP Percentage " + "&nbsp; &nbsp;&nbsp; &nbsp; &nbsp;" + goppct + "<br/>" + "Population " + "&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; " + o.properties.pop_16 + "<br/>" + "Outbound Migrants" + "&nbsp; &nbsp; &nbsp;" + cMigrants[0] + "<br/>" + "Inbound Migrants" + "&nbsp; &nbsp; &nbsp; &nbsp;&nbsp;" + cMigrants[1] ).style("left", (mouse[0]+ 25) + "px").style("top", (mouse[1] - 28) + "px");
		            		}
		            		else{
		            			var exempt = getExemptions(chosen.id,o.id);
		            		tooltipLinks.html("<font size=3>" + "<b>" + o.properties.name + "-" + chosen.properties.name + "</b>" + "</font>" + "<br/>" + o.properties.state + "-" + chosen.properties.state + "<br/>" + "<br/>" + "Inbound Migrants" + "&nbsp;&nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp;" + exempt[0] + "<br/>" + "Outbound Migrants" + "&nbsp; &nbsp; &nbsp; &nbsp; " + exempt[1]).style("left", (mouse[0]+ 25) + "px").style("top", (mouse[1] - 28) + "px");
		            		}

	    		}else{
		    			 tooltipLinks.transition()    
		            	.duration(300)    
		            	.style("opacity", 0); 
		    		}
	    	})

		}



		function transition(path) {
		  path.transition()
		      .duration(1500)
		      .attrTween("stroke-dasharray", tweenDash);
		}

		function tweenDash() {
		  let l = this.getTotalLength(),
		      i = d3.interpolateString("0," + l, l + "," + l);
		  return function(t) { return i(t); };
		}

		//Mouseover function on county
	    function fade(opacity, state){
	    	return d => {
	    		
	    		if(!isClicked){
		    		if(!($.isEmptyObject(d.properties)))
		    		{
			    		if(state == 'over'){
			    			tooltip.transition()    
			            		.duration(200)    
			            		.style("opacity", 0.8);  

			            	
			            	let Migrants = findConnectedCounty(d.id);
			            	let cMigrants = countMigrants(Migrants);
			            	let mouse = d3.mouse(d3.select('.counties').node()); 
			            	let goppct = parseFloat(d.properties.gop_pct_2016).toFixed(2);
			            	tooltip.html("<font size=3>" + "<b>" + d.properties.namelsad + "</b>" + "</font>" + "<br/>" + d.properties.state + "<br/>" + "<br/>" + " GOP Percentage " + "&nbsp; &nbsp;&nbsp; &nbsp; &nbsp;" + goppct + "<br/>" + "Population " + "&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; " + d.properties.pop_16 + "<br/>" + "Outbound Migrants" + "&nbsp; &nbsp; &nbsp;" + cMigrants[0] + "<br/>" + "Inbound Migrants" + "&nbsp; &nbsp; &nbsp; &nbsp;&nbsp;" + cMigrants[1] ).style("left", (mouse[0]+ 30) + "px").style("top", (mouse[1] - 80) + "px");   
			    		} else{
			    			 tooltip.transition()    
			            	.duration(300)    
			            	.style("opacity", 0); 
			    		}

			    		counties.style('fill-opacity', function(o){
			    			const thisOpacity = isConnected(d.id, o.id) ? 1: opacity;
			    			this.setAttribute('fill-opacity', thisOpacity);
			     			return thisOpacity;
			    		})   	
					}    	
				}
			}
	    	
	    }


	  	//Adding state and nation boundaries
		svg.append("path")
	      .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
	      .attr("class", "states")
	      .attr('stroke', 'black')
	      .attr('fill','none')
	      .attr('stroke-width', 1)
	      .attr("d", path)

	    svg.append("path")
	      .attr("d", path(topojson.feature(us, us.objects.nation)))
	      .attr('fill','none')
	      .attr('stroke', 'black')
	      .attr('stroke-width', 1);
	}
