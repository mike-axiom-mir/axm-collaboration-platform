using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Windows.Forms;

internal static class AxmNativeEye
{
    private static string Value(string[] args, string name, string fallback = null)
    {
        for (var index = 0; index < args.Length - 1; index++)
            if (String.Equals(args[index], name, StringComparison.OrdinalIgnoreCase)) return args[index + 1];
        return fallback;
    }

    public static int Main(string[] args)
    {
        try
        {
            var output = Value(args, "--output");
            if (String.IsNullOrWhiteSpace(output)) throw new ArgumentException("--output is required");
            var target = Value(args, "--target", "primary");
            var maxWidth = Math.Max(320, Math.Min(3840, Int32.Parse(Value(args, "--max-width", "1280"))));
            var quality = Math.Max(45, Math.Min(90, Int32.Parse(Value(args, "--quality", "72"))));
            var bounds = String.Equals(target, "virtual", StringComparison.OrdinalIgnoreCase)
                ? SystemInformation.VirtualScreen
                : Screen.PrimaryScreen.Bounds;
            if (bounds.Width < 2 || bounds.Height < 2) throw new InvalidOperationException("Windows returned an invalid capture area");

            using (var source = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb))
            {
                using (var graphics = Graphics.FromImage(source))
                    graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);

                Bitmap resized = null;
                var final = source;
                try
                {
                    if (source.Width > maxWidth)
                    {
                        var height = Math.Max(2, (int)Math.Round(source.Height * (maxWidth / (double)source.Width)));
                        resized = new Bitmap(maxWidth, height, PixelFormat.Format24bppRgb);
                        using (var graphics = Graphics.FromImage(resized))
                        {
                            graphics.CompositingQuality = CompositingQuality.HighQuality;
                            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            graphics.SmoothingMode = SmoothingMode.HighQuality;
                            graphics.DrawImage(source, 0, 0, resized.Width, resized.Height);
                        }
                        final = resized;
                    }

                    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));
                    var codec = ImageCodecInfo.GetImageEncoders().First(item => item.MimeType == "image/jpeg");
                    using (var parameters = new EncoderParameters(1))
                    {
                        parameters.Param[0] = new EncoderParameter(Encoder.Quality, (long)quality);
                        final.Save(output, codec, parameters);
                    }
                    Console.WriteLine("{\"ok\":true,\"target\":\"" + target + "\",\"width\":" + final.Width + ",\"height\":" + final.Height + "}");
                }
                finally { if (resized != null) resized.Dispose(); }
            }
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.ToString());
            return 1;
        }
    }
}
