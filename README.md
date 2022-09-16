# nestjs-leak-reproduction

This test shows how memory leak can occur when the tcp client proxy has an outstanding requests, and 
the connection to the server suddenly closes (due to network issues for example)

When the connection is closed, no one cleans the routing maps, nor calls those callbacks to notify them 
an error has occurred.

The test also introduces a fix (4 lines of code), and a test to verify it.

First test is just a sanity to make sure all messages are handled properly.

Second test sends out the messages to the server, kills all the sockets and then just 
hangs (due to the leak)

Third test is using the fixed ClientTCP and demonstrates how the second test is passing when using it - 
i.e there is no more leak
