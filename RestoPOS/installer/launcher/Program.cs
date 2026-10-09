using System.Diagnostics;
using System.Net;
using System.Windows.Forms;

internal static class Program
{
    private const string AppUrl = "http://127.0.0.1:5077/";
    private static readonly string LogDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "Pnara",
        "logs");

    [STAThread]
    private static async Task Main()
    {
        using var handler = new HttpClientHandler { UseProxy = false };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(3) };
        var deadline = DateTime.UtcNow.AddSeconds(45);

        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var response = await client.GetAsync(new Uri(new Uri(AppUrl), "health"));
                if (response.StatusCode == HttpStatusCode.OK)
                {
                    Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // The automatic Windows service may still be starting.
            }
            catch (TaskCanceledException)
            {
                // Retry after the local service's brief startup timeout.
            }

            await Task.Delay(TimeSpan.FromSeconds(1));
        }

        MessageBox.Show(
            "Pnara Cafe could not connect to its local service. Restart Windows and try again. " +
            $"If the problem continues, ask an administrator to check the service logs in {LogDirectory}.",
            "Pnara Cafe could not start",
            MessageBoxButtons.OK,
            MessageBoxIcon.Error);
    }
}
