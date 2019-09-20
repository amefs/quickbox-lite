

var range_rec = 1024;  // KBps
var range_snd = 1024;  // KBps

if(typeof(EventSource) !== "undefined") 
{
	var stat_source = new EventSource("req/stat.php");
	var rate_rec = 0;
	var rate_snd = 0;
	stat_source.onmessage = function(e)
	{
		var seconds = 1;
		var data = JSON.parse(e.data);
		var new_rec = data.rec;
		var new_snd = data.snd;

		if ( typeof(old_rec) != "undefined" && typeof(old_snd) != "undefined") 
		{ 
			var bytes_rec = new_rec - old_rec;
			var bytes_snd = new_snd - old_snd;

			rate_rec = bytes_rec / seconds / 1024 / 1024;
			rate_snd = bytes_snd / seconds / 1024 / 1024;

			// Check over/under flow
			if ( rate_rec > range_rec  || rate_rec < 0 )
				rate_rec = old_rate_rec;
			else
				old_rate_rec = rate_rec;

			if ( rate_snd > range_snd  || rate_snd < 0 )
				rate_snd = old_rate_snd;
			else
				old_rate_snd = rate_snd;

			document.getElementById("rec_result").innerHTML="" + Math.round(rate_rec*100)/100 + " Mbs";
			document.getElementById("snd_result").innerHTML=""    + Math.round(rate_snd*100)/100 + " Mbs";
		}
		old_rec = new_rec;
		old_snd = new_snd;
	};
	
} else {
	document.getElementById("rec_result").innerHTML=
		"Sorry, your browser does not support server-sent events...";
}


window.onload = function() {

    rec_graph = new Graph(
    {
        'id': "rec_graph",
        'interval': 1000,
        'strokeStyle': "#819C58",
        'fillStyle': "rgba(64,128,0,0.25)",
		'grid': [32,32],
		'range': [0,range_rec],

        'call': function(){return (Math.round(rate_rec));}
    });

    snd_graph = new Graph(
    {
        'id': "snd_graph",
        'interval': 1000,
        'strokeStyle': "#58819C",
        'fillStyle': "rgba(0,88,145,0.25)",
		'grid': [32,32],
		'range': [0,range_snd],

        'call': function(){return (Math.round(rate_snd));}
    });

}
