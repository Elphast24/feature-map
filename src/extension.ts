// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WorkspaceStorage } from "./services/storage/workspaceStorage";
import { ProjectService } from "./services/project/projectService";

// projectService is module-level so commands can import it later.
// In Milestone 5, commands will receive this via a shared context
// rather than a module import — but this is fine for now.
export let projectService: ProjectService;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Build the storage layer
  const storage = new WorkspaceStorage(context.workspaceState);

  // Build the service layer on top of storage
  projectService = new ProjectService(storage);

  // Load any previously saved project into memory immediately.
  // After this, everything reads from projectService.getProject().
  const result = await projectService.loadProject();

  if (result.ok && result.data) {
    console.log(`SBAtlas: loaded project "${result.data.name}"`);
  } else {
    console.log("SBAtlas: no existing project found.");
  }

	// Just trying out some states
	const lastFile = context.workspaceState.get<String>('lastEditedFile', 'None');
	const lastLine = context.workspaceState.get<number>('lastLinePosition',0 );
	const lastChar = context.workspaceState.get<number>('lastCharPosition',0 );
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "sbatlas" is now active!');
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('sbatlas.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from SBAtlas!, prepare for a new adventure!');
		vscode.window.showInformationMessage(
			`Last Update Session[ File:${lastFile} Line:${lastLine} Char:${lastChar} ]`
		);
	});
	
	
		const selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
			const editor = event.textEditor;
	
			if(!editor) {return;}
	
			const document = editor.document;
			const position = event.selections[0].active;
	
			context.workspaceState.update('lastEditedFile', document.fileName);
			context.workspaceState.update('lastLinePosition', position.line + 1);
			context.workspaceState.update('lastCharPosition', position.character + 1);
		});


	context.subscriptions.push(disposable, selectionDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
