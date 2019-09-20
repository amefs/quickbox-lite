/*
Flot plugin for labeling axis

    (xy)axis: {
        label: "label string",
        labelPos: "high" or "low"
    }

This plugin allows you to label an axis without much fuss, by
replacing one of the extreme ticks with the chosen label string. Set
labelPos to "high" or "low" to replace respectively the maximum or the
minimum value of the ticks. User set axis.tickFormatter are respected
and multiple axes supported.

Rui Pereira
rui (dot) pereira (at) gmail (dot) com
*/
(function ($) {

    function labelAxis(val, axis){
        var ticks, opts = axis.options;

        // generator
        var tmpopts = axis.n == 1? opts: (typeof opts.alignedTo != 'undefined')? opts.alignedTo.options: null;
        // first axis or some axis aligned wrt it
        if (tmpopts && (tmpopts.autoscaleMargin == null ||
                (tmpopts.labelPos == 'high' && tmpopts.max != null) ||
                (tmpopts.labelPos == 'low' && tmpopts.min != null)))
            // cut ticks not seen
            ticks = $.grep(axis.tickGenerator(axis), function(v){
                return (v >= axis.min && v <= axis.max);
            });
        // standard tick generator
        else ticks = axis.tickGenerator(axis);

        // formatter
        if ((opts.labelPos == 'high' && val == ticks[ticks.length-1]) ||
                (opts.labelPos == 'low' && val == ticks[0]))
            return opts.label;
        else {
            // user set tickFormatter
            if ($.isFunction(opts.userFormatter)){
                var tmp = opts.userFormatter;
                // avoid infinite loops
                opts.userFormatter = null;
                return tmp(val, axis);
            } else {
                // scientific notation for small values
                if ((axis.datamax != 0 && Math.abs(axis.datamax) < 1e-5) ||
                        (axis.datamin != 0 && Math.abs(axis.datamin) < 1e-5))
                    return val.toPrecision(2);
                else return val.toFixed(axis.tickDecimals);
            }
        }
    }

    function init(plot){
        plot.hooks.processOptions.push(function(plot, options){
            // separate X and Y
            $.each({x: options.xaxes, y: options.yaxes}, function(direction, axes){
                // get only axes with labels
                $.each($.grep(axes, function(v){
                    return (typeof v.label != 'undefined' && v.label);
                }), function(i, axis){
                    if ($.isFunction(axis.tickFormatter))
                        axis.userFormatter = axis.tickFormatter;
                    if (typeof axis.alignTicksWithAxis != 'undefined')
                        $.each(plot.getAxes(), function(k,v){
                            if (v.n == axis.alignTicksWithAxis && v.direction == direction)
                                axis.alignedTo = v;
                        });
                    axis.tickFormatter = labelAxis;
                });
            });
        });
    }

    var options = { xaxis: {label: null, labelPos: 'high'},
                    yaxis: {label: null, labelPos: 'high'} };

    $.plot.plugins.push({
                init: init,
                options: options,
                name: "axislabels",
                version: "0.1"
            });
})(jQuery);