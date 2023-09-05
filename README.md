Simple OS implementation:

```javascript

const multiprocessing = () => {
  const list = [process1, process2];
  const processState = {
    id: 0,
    code: '',
    registries: [],
    memoryPages: [],
    stopPoint: 0,
  };

  const runProcess = (process) => (process);
  const saveProcessState = (processId, processState) => processState[processId] = processState;
  const getProcessState = (processId) => processState[processId];
  const pauseProcess = (process, processState) => saveProcessState(process.id, processState);
  const runFromTheLastPoint = (processState) => processState.lastCode;
  const loadProcessState = (processState) => runFromTheLastPoint(processState);
  const resumeProcess = (processState) => loadProcessState(processState);

  while(true) {
    const currentProcess = list[0];

    const processState = getProcessState(currentProcess.id);

    if (processState) {
      const code = resumeProcess(processState);
      code();
    }

    const processResult = runProcess(currentProcess);
    pauseProcess(currentProcess, processResult);
  }
}


```