"use strict";

var HOST = 'http://localhost:8080';

function showModule(id) {
	$('#module').css('display', 'block');
	$.getJSON(HOST + '/modules/' + id, function(data, status) {
		let split = data['identifier'].split('.');
		let shortName = split[split.length - 1];

		// legend
		$('#module legend').empty().append(
				$(document.createElement('a')).text(shortName)
				.attr('href', HOST + '/modules/' + data['identifier']));

		// inputs
		$('#inputs').empty();
		let getInput = function(name, dt_class, java_type) {
			// template for "inputs"
			return $([
				`<dt>`,
					`<span class="${dt_class}">${name}</span> <span>(${java_type})</span>`,
				`</dt>`,
				`<dd>`,
					`<span class="input active">JSON: <input class="_input_${name}" type="text" size="10"></span>`,
					`<span> or </span>`,
					`<span class="input">File: <input class="_input_${name}" type="file"></span>`,
				`</dd>`
			].join('\n'));
		};
		for (let input of data['inputs']) {
			$('#inputs').append(getInput(input['name'],
					input['required'] ? 'required' : 'optional',
					input['genericType']));
		}
		$('.input input').change(function() {
			$('.' + $(this).attr('class')).parent().removeClass('active');
			$(this).parent().addClass('active');
		});

		// outputs
		$('#outputs').empty();
		let genOutput = function(name, java_type) {
			// template for "outputs"
			return $([
				`<dt>`,
					`<span>${name}</span> <span>(${java_type})</span>`,
				`</dt>`,
				`<dd>`,
					`<span>Value: <span class="value _output_${name}"></span></span>`,
				`</dd>`,
			].join('\n'));
		}
		for (let output of data['outputs']) {
			$('#outputs').append(genOutput(output['name'], output['genericType']));
		}

		// execute
		$('form').off('submit').on('submit', function(event) {
			event.preventDefault();
			let jsonInputs = {};
			let deferreds = [];
			$('.active input').each(function(index, element) {
				let inputName = $(element).attr('class').substr('_input_'.length);
				if ($(element).attr('type') == 'file') { // upload file
					let data = new FormData();
					data.append('file', $(element).prop('files')[0]);
					deferreds.push($.ajax({
						async: false,
						url: HOST + '/objects/upload',
						type: 'POST',
						data: data,
						cache: false,
						contentType: false,
						processData: false,
						success: function(rtn, status, xhr) {
							jsonInputs[inputName] = rtn['id'];
						},
						error: function(xhr, status, err) {
							console.log(err);
						}
					}));
				} else {
					jsonInputs[inputName] = JSON.parse($(element).val());
				}
			});
			// wait for all ajax (upload file) to complete before execution
			$.when(...deferreds).then(function() {
				$.ajax({
					type: 'POST',
					url: HOST + '/modules/' + id,
					data: JSON.stringify(jsonInputs),
					success: function(outputs, status) {
						// populate outputs
						for (let name in outputs) {
							let output = outputs[name];
							let text = JSON.stringify(output, null, 2); // pretty
																		// print
																		// JSON
							let span = $(`.value._output_${name}`)
							if ((typeof output) == "string" && output.startsWith('object:')) {
								span.empty();
								let obj_url = HOST + '/objects/' + output;
								span.append($([
									`<a href="${obj_url}" target="_blank">${text}</a>`,
									`<button class="_output_${name}">View As</button>`,
									`<input class="format _output_${name}" type="text" size="5" value="png">`
								].join('\n')));
								$(`button._output_${name}`).on('click', function() {
									let clazz = $(this).attr('class');
									let url = HOST + '/objects/' + output + '/' + $(`.format.${clazz}`).val();
									window.open(url, 'popUpWindow');
								})
							} else {
								span.text(output);
							}
						}
					},
					error: function(xhr, status, err) {
						console.log(err);
					},
					dataType: 'json',
					contentType: 'application/json'
				})
			});
		});
	});
}

function showModules() {
	$.getJSON(HOST + '/modules', function(data, status) {
		let optgroups = {}; // for now, we only have "command"
		for ( let module of data) {
			let firstcolon = module.indexOf(':');
			let lastdot = module.lastIndexOf('.');

			let type = module.slice(0, firstcolon);
			let clazz = module.slice(lastdot + 1);
			let source = module.slice(firstcolon + 1, lastdot);

			if (!(type in optgroups)) {
				optgroups[type] = [];
			}

			let text = clazz + ' (' + source + ')';
			optgroups[type].push($(document.createElement('option'))
					.text(text)
					.attr({value: module})
					.addClass('module'));
		}

		for (let type in optgroups) {
			let optgroup = $(document.createElement('optgroup')).attr({
				label : type
			});
			$('#modules').append(optgroup);
			optgroups[type].sort(function(a, b) {
				return a.text() < b.text() ? -1 : 1;
			});
			optgroup.append(optgroups[type]);
		}

		$('#modules').attr({
			size : Math.min(10, data.length)
		}).change(function() {
			showModule(this.value);
		});
	});
}

window.onload = showModules;