function foobar() {
	var x = 'bar';
}
global.foobar = foobar;
global.aGlobalVar = 'foobar';
const foo = () => {};
global.foo = foo;
let win = Ti.UI.createWindow({
	backgroundColor: 'white'
});
global.win = win;
var textField = Ti.UI.createTextField({
	borderStyle: Ti.UI.INPUT_BORDERSTYLE_BEZEL,
	color: '#336699',
	top: 10, left: 10,
	width: 250, height: 60
});
global.textField = textField;
win.add(textField);
win.open();
